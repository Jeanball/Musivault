import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCollectionData } from '../hooks/collection/useCollectionData';
import { useCollectionStats } from '../hooks/collection/useCollectionStats';
import { useCollectionSyncInfo } from '../hooks/collection/useCollectionSyncInfo';
import { useValueHistory } from '../hooks/collection/useValueHistory';
import { useRefreshOnVisible } from '../hooks/useRefreshOnVisible';
import StatsKpiRow from '../components/Stats/StatsKpiRow';
import DistributionSection from '../components/Stats/DistributionSection';
import TopValueItems from '../components/Stats/TopValueItems';
import { useCurrency } from '../hooks/useCurrency';

const StatsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { collection, isLoading, refreshCollection } = useCollectionData();
    const stats = useCollectionStats(collection);
    const syncInfo = useCollectionSyncInfo(collection.length > 0);
    const { points, reload } = useValueHistory();
    const { formatValue, formatCompactValue } = useCurrency();

    // The chart reads the snapshot table, the KPIs read the collection. Refresh
    // both together or the last point of the curve stops matching the total
    // value tile right above it.
    useRefreshOnVisible(useCallback(() => {
        void reload();
        void refreshCollection();
    }, [reload, refreshCollection]));

    const formatDateTime = (value: string) => {
        return new Date(value).toLocaleString(i18n.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (isLoading && collection.length === 0) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    return (
        <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold">{t('nav.stats', 'Stats')}</h1>
                <p className="text-base-content/60 mt-2">{t('stats.subtitle')}</p>
            </div>

            <StatsKpiRow stats={stats} />

            <DistributionSection stats={stats} />

            <TopValueItems collection={collection} />

            {/* Evolution Graph Section. Two points minimum: a single one draws
                no line and reads as a broken chart rather than a young one. */}
            {points.length > 1 && (
                <div className="bg-base-100 rounded-box shadow-panel p-4 md:p-6">
                    {/* The sync belongs here rather than beside the record count:
                        refresh-prices is what appends a point to this curve, and
                        it moves nothing else on the page. */}
                    <div className="mb-6 flex flex-col gap-1">
                        <h2 className="text-xl font-bold">{t('stats.evolutionTitle')}</h2>
                        <p className="text-sm text-base-content/60">
                            {t('stats.nextAutoSync')}: {syncInfo?.nextAutoSyncAt
                                ? formatDateTime(syncInfo.nextAutoSyncAt)
                                : t('stats.noAutoSyncScheduled')}
                        </p>
                    </div>
                    <div className="w-full h-[300px] md:h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={points}
                                margin={{
                                    top: 10,
                                    right: 10,
                                    left: 0,
                                    bottom: 0,
                                }}
                            >
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        {/* Using Tailwind/DaisyUI primary color with opacity */}
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklab, var(--color-base-content) 10%, transparent)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="color-mix(in oklab, var(--color-base-content) 50%, transparent)"
                                    fontSize={12}
                                    tickMargin={10}
                                    minTickGap={24}
                                    tickFormatter={(val) => {
                                        // Shorten date for small screens or standard format
                                        const d = new Date(val);
                                        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(2)}`;
                                    }}
                                />
                                {/* Compact ticks ("$1.9K"): a full "$1,900.00" overflows the
                                    axis box on a phone and loses its leading digits. The
                                    tooltip below still gives the exact amount.
                                    width="auto" because label length follows the currency:
                                    "$1.4K" is narrow, "CHF 123.4K" is not, and a fixed
                                    width either clips the latter or wastes space on the
                                    former. */}
                                <YAxis
                                    stroke="color-mix(in oklab, var(--color-base-content) 50%, transparent)"
                                    fontSize={12}
                                    tickLine={false}
                                    width="auto"
                                    tickFormatter={(val) => formatCompactValue(val)}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--color-base-200)',
                                        borderColor: 'var(--color-base-300)',
                                        borderRadius: '0.5rem',
                                        color: 'var(--color-base-content)'
                                    }}
                                    itemStyle={{ color: 'var(--color-primary)' }}
                                    formatter={(value: any) => [formatValue(value), t('stats.value')]}
                                    labelFormatter={(label) => `${t('stats.chartDateLabel')}: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="var(--color-primary)"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsPage;
