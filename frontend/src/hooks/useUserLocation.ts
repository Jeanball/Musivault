import { useState, useEffect, useCallback, useRef } from 'react';
import { getPreferences, updatePreferences } from '../api/preferences';
import { getApproximateLocation } from '../api/discover';
import type { UserLocation } from '../types/preferences.types';

export type LocationStatus = 'resolving' | 'ready' | 'unavailable';

/** Which geolocation failure occurred, so callers can pick the right message. */
export type LocationErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecureContext';

const BROWSER_GEOLOCATION_TIMEOUT_MS = 10_000;

/**
 * Resolves the position used by the nearby record shops, in order:
 *   1. the position stored in preferences (no network call),
 *   2. an IP-based guess, so something renders without a permission prompt,
 *   3. the precise browser position — only ever on an explicit user action.
 *
 * The browser prompt is never triggered on mount: an unprompted permission
 * dialog is hostile and gets denied, which then blocks the precise option for
 * good.
 */
export function useUserLocation() {
    const [location, setLocation] = useState<UserLocation | null>(null);
    const [status, setStatus] = useState<LocationStatus>('resolving');
    const [error, setError] = useState<LocationErrorKind | null>(null);
    const [isRequestingPrecise, setIsRequestingPrecise] = useState(false);

    // Preferences persistence is fire-and-forget; a failure must not break the UI.
    const persist = useCallback((next: UserLocation | null) => {
        updatePreferences({ discoverLocation: next }).catch((err) => {
            console.error('Failed to persist discover location:', err);
        });
    }, []);

    // Re-armed on every mount, not just the first: StrictMode mounts, unmounts
    // and remounts in dev, and a ref that only ever flips to false would leave
    // the remounted hook unable to commit any state.
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);

    useEffect(() => {
        const resolve = async () => {
            try {
                const preferences = await getPreferences();
                if (!active.current) return;

                if (preferences.discoverLocation) {
                    setLocation(preferences.discoverLocation);
                    setStatus('ready');
                    return;
                }

                const approximate = await getApproximateLocation();
                if (!active.current) return;

                if (approximate.source === 'unavailable') {
                    setStatus('unavailable');
                    return;
                }

                const ipLocation: UserLocation = {
                    lat: approximate.lat,
                    lon: approximate.lon,
                    label: [approximate.city, approximate.country].filter(Boolean).join(', ') || undefined,
                    source: 'ip',
                };
                setLocation(ipLocation);
                setStatus('ready');
                persist(ipLocation);
            } catch (err) {
                console.error('Failed to resolve location:', err);
                if (active.current) setStatus('unavailable');
            }
        };

        resolve();
    }, [persist]);

    /** Must be called from a user gesture — this is what shows the browser prompt. */
    const requestBrowserLocation = useCallback(() => {
        if (!('geolocation' in navigator)) {
            setError('unsupported');
            return;
        }

        // Browsers gate the Geolocation API behind a secure context, and some
        // report the refusal as PERMISSION_DENIED — which would send the user
        // hunting through their permission settings for nothing. Catch it here
        // so the message names the real cause. Hits dev over a LAN IP mostly:
        // localhost is a secure context, plain http://10.x.x.x is not.
        // Compared against false rather than falsy: an environment that doesn't
        // define the flag at all should fall through and let the browser decide,
        // not be told its origin is insecure.
        if (window.isSecureContext === false) {
            setError('insecureContext');
            return;
        }

        setError(null);
        setIsRequestingPrecise(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (!active.current) return;
                const precise: UserLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    source: 'browser',
                };
                setLocation(precise);
                setStatus('ready');
                setIsRequestingPrecise(false);
                persist(precise);
            },
            (positionError) => {
                if (!active.current) return;
                setIsRequestingPrecise(false);
                if (positionError.code === positionError.PERMISSION_DENIED) {
                    setError('denied');
                } else if (positionError.code === positionError.TIMEOUT) {
                    setError('timeout');
                } else {
                    setError('unavailable');
                }
            },
            { timeout: BROWSER_GEOLOCATION_TIMEOUT_MS, maximumAge: 5 * 60 * 1000 }
        );
    }, [persist]);

    /** Position picked from the manual place search. */
    const setManualLocation = useCallback((lat: number, lon: number, label: string) => {
        const manual: UserLocation = { lat, lon, label, source: 'manual' };
        setLocation(manual);
        setStatus('ready');
        setError(null);
        persist(manual);
    }, [persist]);

    return { location, status, error, isRequestingPrecise, requestBrowserLocation, setManualLocation };
}
