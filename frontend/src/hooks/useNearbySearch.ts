import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserLocation } from './useUserLocation';
import { useDebounce } from './useDebounce';
import { getPreferences, updatePreferences } from '../api/preferences';
import { isApiError } from '../api/errors';
import { MIN_RADIUS_KM, MAX_RADIUS_KM } from '../components/Discover/constants';

export const DEFAULT_RADIUS_KM = 25;
/** Long enough that dragging the slider across its range costs one request, not a hundred. */
const RADIUS_DEBOUNCE_MS = 400;

/**
 * The position and radius every "near you" section shares — one setting, so
 * moving the slider once moves record shops and concerts together instead of
 * making the user tune each list separately.
 *
 * Call this once per page and hand the result to `NearbyControls` and to every
 * `useNearbySearch` on that page.
 */
export function useNearby() {
    const locationState = useUserLocation();
    const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
    const debouncedRadiusKm = useDebounce(radiusKm, RADIUS_DEBOUNCE_MS);

    useEffect(() => {
        getPreferences()
            // Clamped on read: the maximum has come down over time, and a stored
            // value above it would put the slider outside its own range and make
            // every save fail validation.
            .then((preferences) => setRadiusKm(
                Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, preferences.discoverRadiusKm ?? DEFAULT_RADIUS_KM))
            ))
            .catch(() => { /* the default radius is fine if preferences are unreachable */ });
    }, []);

    /** Called once the user lets go of the slider — persistence is fire-and-forget. */
    const commitRadius = useCallback((value: number) => {
        updatePreferences({ discoverRadiusKm: value }).catch((err) => {
            console.error('Failed to persist discover radius:', err);
        });
    }, []);

    return { ...locationState, radiusKm, setRadiusKm, debouncedRadiusKm, commitRadius };
}

export type NearbyState = ReturnType<typeof useNearby>;

/**
 * Runs a location-and-radius search, refetching when either changes.
 *
 * `deps` carries any extra filter that has to reach the server — the concert
 * date window, for instance. Filters the client can apply itself belong in a
 * `useMemo` over `items`, not here.
 */
export function useNearbySearch<T>(
    nearby: NearbyState,
    fetcher: (lat: number, lon: number, radiusKm: number) => Promise<T[]>,
    errorKey: string,
    deps: unknown[] = []
) {
    const { t } = useTranslation();
    const { location, debouncedRadiusKm } = nearby;

    const [items, setItems] = useState<T[]>([]);
    // Starts true: the location resolves first, and a false here would flash
    // the empty state for a frame before the fetch effect gets to run.
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** The feature needs configuration this instance doesn't have (503). */
    const [unavailable, setUnavailable] = useState(false);

    useEffect(() => {
        if (!location) return;

        let active = true;
        setIsLoading(true);
        fetcher(location.lat, location.lon, debouncedRadiusKm)
            .then((found) => {
                if (!active) return;
                setItems(found);
                setError(null);
                setUnavailable(false);
            })
            .catch((err) => {
                if (!active) return;
                // 503 means the server is missing an API key for this feature —
                // an instance-wide configuration state, not a failure the user
                // can act on. Callers hide the section rather than shout at
                // everyone who never set the key up.
                if (isApiError(err) && err.status === 503) {
                    setUnavailable(true);
                    setError(null);
                    return;
                }
                console.error(`Failed to fetch ${errorKey}:`, err);
                setError(t(errorKey));
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => { active = false; };
        // The fetcher is an inline closure at every call site and would rerun
        // this on each render if depended upon; `deps` is what actually changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location, debouncedRadiusKm, ...deps]);

    return { items, isLoading, error, unavailable };
}
