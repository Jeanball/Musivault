import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Search, AlertCircle } from 'lucide-react';
import BackButton from '../components/Common/BackButton';
import RecordShopCard from '../components/Discover/RecordShopCard';
import RecordShopCardSkeleton from '../components/Discover/RecordShopCardSkeleton';
import RadiusSlider from '../components/Discover/RadiusSlider';
import LocationControls from '../components/Discover/LocationControls';
import OsmAttribution from '../components/Discover/OsmAttribution';
import { useUserLocation } from '../hooks/useUserLocation';
import { useDebounce } from '../hooks/useDebounce';
import type { RecordShop } from '../types/discover.types';
import { getRecordShops } from '../api/discover';
import { getPreferences, updatePreferences } from '../api/preferences';

const DEFAULT_RADIUS_KM = 25;
/** Long enough that dragging the slider across its range costs one request, not a hundred. */
const RADIUS_DEBOUNCE_MS = 400;

const RecordShopsPage: React.FC = () => {
    const { t } = useTranslation();
    const { location, status: locationStatus, error: locationError, isRequestingPrecise, requestBrowserLocation, setManualLocation } = useUserLocation();

    const [shops, setShops] = useState<RecordShop[]>([]);
    // See DiscoverPage: true avoids a one-frame flash of the empty state.
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);

    const debouncedRadiusKm = useDebounce(radiusKm, RADIUS_DEBOUNCE_MS);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        getPreferences()
            .then((preferences) => setRadiusKm(preferences.discoverShopRadiusKm ?? DEFAULT_RADIUS_KM))
            .catch(() => { /* the default radius is fine if preferences are unreachable */ });
    }, []);

    useEffect(() => {
        if (!location) return;

        let active = true;
        setIsLoading(true);
        getRecordShops(location.lat, location.lon, debouncedRadiusKm)
            .then((found) => {
                if (!active) return;
                setShops(found);
                setError(null);
            })
            .catch((err) => {
                if (!active) return;
                console.error('Failed to fetch record shops:', err);
                setError(t('discover.failedLoadShops'));
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location, debouncedRadiusKm]);

    const persistRadius = (value: number) => {
        updatePreferences({ discoverShopRadiusKm: value }).catch((err) => {
            console.error('Failed to persist shop radius:', err);
        });
    };

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return shops;
        return shops.filter((shop) =>
            shop.name.toLowerCase().includes(q) ||
            shop.city?.toLowerCase().includes(q) ||
            shop.street?.toLowerCase().includes(q)
        );
    }, [shops, query]);

    return (
        <div className="max-w-6xl mx-auto">
            <BackButton />

            <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                    <Store size={32} />
                    {t('discover.shopsPageTitle')}
                </h1>
                <p className="text-base-content/70">{t('discover.shopsPageSubtitle')}</p>
            </div>

            <div className="bg-base-200 rounded-xl p-4 mb-8 space-y-4">
                <LocationControls
                    location={location}
                    error={locationError}
                    isRequestingPrecise={isRequestingPrecise}
                    onRequestPrecise={requestBrowserLocation}
                    onManualLocation={setManualLocation}
                    // Open by default only when there is nothing to change yet;
                    // otherwise it sits behind the toggle, as on Discover.
                    showManualSearch={!location}
                />

                <div className="flex flex-wrap items-end gap-4">
                    <RadiusSlider value={radiusKm} onChange={setRadiusKm} onCommit={persistRadius} />

                    <label className="input input-bordered flex items-center gap-2 flex-1 min-w-52 max-w-md">
                        <Search size={18} className="opacity-60" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('discover.searchShops')}
                            className="grow"
                        />
                    </label>
                </div>
            </div>

            {/* Also covers radius changes, which refetch on a debounce. */}
            {locationStatus === 'resolving' || (location && isLoading) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                    <RecordShopCardSkeleton count={9} />
                </div>
            ) : error ? (
                <div className="alert alert-error">
                    <AlertCircle className="shrink-0 h-6 w-6" />
                    <span>{error}</span>
                </div>
            ) : !location ? (
                <div className="bg-base-200 rounded-xl p-8 text-center border-2 border-dashed border-base-300">
                    <div className="flex justify-center mb-4">
                        <Store size={48} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{t('discover.findShopsNearYou')}</h3>
                    <p className="text-base-content/60 max-w-md mx-auto text-sm md:text-base">
                        {t('discover.locationNeeded')}
                    </p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-base-200 rounded-xl p-8 text-center border-2 border-dashed border-base-300">
                    <div className="flex justify-center mb-4">
                        <Store size={48} />
                    </div>
                    <p className="text-base-content/60">
                        {query
                            ? t('discover.noShopsMatchSearch', { query })
                            : t('discover.noShopsInRadius', { radius: radiusKm })}
                    </p>
                    {!query && (
                        <p className="text-base-content/60 text-sm mt-2 max-w-md mx-auto">
                            {t('discover.noShopsHint')}
                        </p>
                    )}
                </div>
            ) : (
                <>
                    <p className="text-sm text-base-content/60 mb-3">
                        {t('discover.shopsFound', { count: filtered.length, radius: radiusKm })}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                        {filtered.map((shop) => (
                            <RecordShopCard key={`${shop.osmType}-${shop.osmId}`} shop={shop} />
                        ))}
                    </div>
                    <OsmAttribution />
                </>
            )}
        </div>
    );
};

export default RecordShopsPage;
