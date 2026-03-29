import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCollectionData } from '../hooks/collection/useCollectionData';
import { useCollectionStats } from '../hooks/collection/useCollectionStats';
import CollectionStats from '../components/Collection/CollectionStats';
import { getItemValue } from '../types/collection.types';

const StatsPage: React.FC = () => {
    const { t } = useTranslation();
    const { collection, isLoading, refreshCollection } = useCollectionData();
    const stats = useCollectionStats(collection);

    // Compute chart data: Evolution of the collection's total value over time.
    // We group items by their 'addedAt' date and calculate the cumulative value.
    const chartData = useMemo(() => {
        if (!collection || collection.length === 0) return [];

        // Sort items by addition date
        const sorted = [...collection].sort(
            (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime()
        );

        // Group by day (YYYY-MM-DD) and sum the values
        const dailyTotals: Record<string, number> = {};
        for (const item of sorted) {
            const dateObj = new Date(item.addedAt);
            // Quick formatted date string e.g., '2023-10-01'
            const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

            const val = getItemValue(item);
            dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + val;
        }

        // Build the cumulative time series
        const series: { date: string; value: number }[] = [];
        let cumulative = 0;

        for (const [date, dailyValue] of Object.entries(dailyTotals)) {
            cumulative += dailyValue;
            series.push({
                date,
                value: Math.round(cumulative * 100) / 100,
            });
        }

        return series;
    }, [collection]);

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
                <p className="text-base-content/60 mt-2">
                    {t('stats.subtitle', 'Analytics and valuation of your music collection.')}
                </p>
            </div>

            {/* Existing Stats component (imported as-is, which renders its expandable UI) */}
            {/* Note: CollectionStats is built with a click-to-expand block, but here the user will just unfold it or we leave it to unfold.
                Actually we can let it be its normal behaviour. */}
            <CollectionStats stats={stats} onSyncComplete={refreshCollection} />

            {/* Evolution Graph Section */}
            {chartData.length > 0 && stats.totalValue > 0 && (
                <div className="bg-base-100 rounded-box shadow-lg p-4 md:p-6">
                    <h2 className="text-xl font-bold mb-6">{t('stats.evolutionTitle', 'Portfolio Evolution')}</h2>
                    <div className="w-full h-[300px] md:h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={chartData}
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
                                        <stop offset="5%" stopColor="oklch(var(--p))" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="oklch(var(--p))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--bc) / 0.1)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="oklch(var(--bc) / 0.5)"
                                    fontSize={12}
                                    tickMargin={10}
                                    tickFormatter={(val) => {
                                        // Shorten date for small screens or standard format
                                        const d = new Date(val);
                                        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(2)}`;
                                    }}
                                />
                                <YAxis
                                    stroke="oklch(var(--bc) / 0.5)"
                                    fontSize={12}
                                    tickFormatter={(val) => `$${val}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'oklch(var(--b2))',
                                        borderColor: 'oklch(var(--b3))',
                                        borderRadius: '0.5rem',
                                        color: 'oklch(var(--bc))'
                                    }}
                                    itemStyle={{ color: 'oklch(var(--p))' }}
                                    formatter={(value: any) => [`${value} ${stats.valueCurrency}`, t('stats.value', 'Value')]}
                                    labelFormatter={(label) => `${t('common.date', 'Date')}: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="oklch(var(--p))"
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
