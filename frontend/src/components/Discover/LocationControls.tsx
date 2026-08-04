import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Crosshair, Search, LocateFixed, Pencil } from 'lucide-react';
import { geocodePlace } from '../../api/discover';
import type { GeocodeResult } from '../../types/discover.types';
import type { UserLocation } from '../../types/preferences.types';
import type { LocationErrorKind } from '../../hooks/useUserLocation';

interface LocationControlsProps {
    location: UserLocation | null;
    error: LocationErrorKind | null;
    isRequestingPrecise: boolean;
    onRequestPrecise: () => void;
    onManualLocation: (lat: number, lon: number, label: string) => void;
    /**
     * Opens the place search straight away. Where a location is already set the
     * search stays reachable regardless, behind the "change" toggle.
     */
    showManualSearch?: boolean;
}

const ERROR_KEYS: Record<LocationErrorKind, string> = {
    denied: 'discover.geolocationDenied',
    unavailable: 'discover.geolocationUnavailable',
    timeout: 'discover.geolocationTimeout',
    unsupported: 'discover.geolocationUnsupported',
    insecureContext: 'discover.geolocationInsecureContext',
};

const LocationControls: React.FC<LocationControlsProps> = ({
    location,
    error,
    isRequestingPrecise,
    onRequestPrecise,
    onManualLocation,
    showManualSearch = false,
}) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeocodeResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const searchVisible = showManualSearch || isSearchOpen;

    const search = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (trimmed.length < 2) return;

        setIsSearching(true);
        setSearchError(null);
        try {
            const found = await geocodePlace(trimmed);
            setResults(found);
            if (found.length === 0) setSearchError(t('discover.noPlacesFound', { query: trimmed }));
        } catch (err) {
            console.error('Failed to geocode place:', err);
            setSearchError(t('discover.failedGeocode'));
        } finally {
            setIsSearching(false);
        }
    };

    const pick = (result: GeocodeResult) => {
        onManualLocation(result.lat, result.lon, result.label);
        setResults([]);
        setQuery('');
        setSearchError(null);
        setIsSearchOpen(false);
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                {location && (
                    <span className="text-sm text-base-content/70 flex items-center gap-1.5">
                        <MapPin size={14} className="opacity-60" />
                        {location.label || t('discover.currentPosition')}
                        {location.source === 'ip' && (
                            <span className="badge badge-ghost badge-xs">{t('discover.approximate')}</span>
                        )}
                    </span>
                )}
                {location?.source !== 'browser' && (
                    <button
                        onClick={onRequestPrecise}
                        disabled={isRequestingPrecise}
                        className="btn btn-outline btn-sm gap-1.5"
                    >
                        {isRequestingPrecise
                            ? <span className="loading loading-spinner loading-xs" />
                            : <Crosshair size={14} />}
                        {t('discover.usePreciseLocation')}
                    </button>
                )}
                {location?.source === 'browser' && (
                    <span className="badge badge-success badge-outline badge-sm gap-1">
                        <LocateFixed size={12} />
                        {t('discover.preciseLocation')}
                    </span>
                )}
                {/* Always reachable, so a position — however it was set — can be
                    corrected at any time, not just after a failure. */}
                {location && !showManualSearch && (
                    <button
                        onClick={() => setIsSearchOpen((open) => !open)}
                        className="btn btn-ghost btn-sm gap-1.5"
                        aria-expanded={isSearchOpen}
                    >
                        <Pencil size={14} />
                        {t('discover.changeLocation')}
                    </button>
                )}
            </div>

            {error && <p className="text-xs text-warning">{t(ERROR_KEYS[error])}</p>}

            {searchVisible && (
                <div>
                    <form onSubmit={search} className="flex flex-wrap items-center gap-2">
                        <label className="input input-sm flex items-center gap-2 flex-1 min-w-52 max-w-sm">
                            <Search size={16} className="opacity-60" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('discover.searchCityPlaceholder')}
                                className="grow"
                            />
                        </label>
                        <button type="submit" className="btn btn-sm" disabled={isSearching || query.trim().length < 2}>
                            {isSearching ? <span className="loading loading-spinner loading-xs" /> : t('discover.searchPlace')}
                        </button>
                    </form>

                    {searchError && <p className="text-xs text-error mt-1">{searchError}</p>}

                    {results.length > 0 && (
                        <ul className="menu w-full bg-base-200 rounded-box mt-2 max-w-lg">
                            {results.map((result) => (
                                <li key={`${result.lat},${result.lon}`}>
                                    <button onClick={() => pick(result)} className="text-sm text-left">
                                        {result.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default LocationControls;
