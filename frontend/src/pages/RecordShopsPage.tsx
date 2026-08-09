import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Search, AlertCircle } from 'lucide-react';
import BackButton from '../components/Common/BackButton';
import CardSkeleton from '../components/Common/CardSkeleton';
import EmptyState from '../components/Common/EmptyState';
import RecordShopCard from '../components/Discover/RecordShopCard';
import NearbyControls from '../components/Discover/NearbyControls';
import OsmAttribution from '../components/Discover/OsmAttribution';
import { RESULTS_GRID_CLASS } from '../components/Discover/constants';
import { useNearby, useNearbySearch } from '../hooks/useNearbySearch';
import type { RecordShop } from '../types/discover.types';
import { getRecordShops } from '../api/discover';

const RecordShopsPage: React.FC = () => {
    const { t } = useTranslation();
    const nearby = useNearby();
    const { items: shops, isLoading, error } = useNearbySearch<RecordShop>(
        nearby,
        getRecordShops,
        'discover.failedLoadShops'
    );

    const [query, setQuery] = useState('');

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

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

            <div className="mb-8">
                <NearbyControls nearby={nearby}>
                    <label className="input flex items-center gap-2 flex-1 min-w-52 max-w-md">
                        <Search size={18} className="opacity-60" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('discover.searchShops')}
                            className="grow"
                        />
                    </label>
                </NearbyControls>
            </div>

            {/* Also covers radius changes, which refetch on a debounce. */}
            {nearby.status === 'resolving' || (nearby.location && isLoading) ? (
                <div className={RESULTS_GRID_CLASS}>
                    <CardSkeleton count={9} />
                </div>
            ) : error ? (
                <div className="alert alert-error">
                    <AlertCircle className="shrink-0 h-6 w-6" />
                    <span>{error}</span>
                </div>
            ) : !nearby.location ? (
                <EmptyState
                    icon={Store}
                    title={t('discover.findShopsNearYou')}
                    description={t('discover.locationNeeded')}
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={Store}
                    description={query
                        ? t('discover.noShopsMatchSearch', { query })
                        : t('discover.noShopsInRadius', { radius: nearby.radiusKm })}
                >
                    {!query && (
                        <p className="text-base-content/60 text-sm max-w-md mx-auto">
                            {t('discover.noShopsHint')}
                        </p>
                    )}
                </EmptyState>
            ) : (
                <>
                    <p className="text-sm text-base-content/60 mb-3">
                        {t('discover.shopsFound', { count: filtered.length, radius: nearby.radiusKm })}
                    </p>
                    <div className={RESULTS_GRID_CLASS}>
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
