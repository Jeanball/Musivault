import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCollectionData } from '../hooks/collection/useCollectionData';
import { useCollectionStats } from '../hooks/collection/useCollectionStats';
import CollectionStats from '../components/Collection/CollectionStats';
import { getItemValue } from '../types/collection.types';
import { toastService } from '../utils/toast';

const StatsPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { collection, isLoading, refreshCollection } = useCollectionData();
    const stats = useCollectionStats(collection);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState('');
    const [showBlockerModal, setShowBlockerModal] = useState(false);
    const [pendingHref, setPendingHref] = useState<string | null>(null);

    useEffect(() => {
        if (!isSyncing) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest('a');

            if (anchor && anchor.href && !anchor.href.includes('#')) {
                e.preventDefault();
                e.stopPropagation();

                const url = new URL(anchor.href);
                setPendingHref(url.pathname + url.search + url.hash);
                setShowBlockerModal(true);
            }
        };

        document.documentElement.addEventListener('click', handleClick, true);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.documentElement.removeEventListener('click', handleClick, true);
        };
    }, [isSyncing]);

    const handleSyncValues = async () => {
        setIsSyncing(true);
        setSyncProgress('');

        try {
            const response = await fetch('/api/collection/sync-values', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok || !response.body) {
                throw new Error('Sync failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === 'progress') {
                            setSyncProgress(`${event.current}/${event.total} — ${event.artist} - ${event.title}`);
                        } else if (event.type === 'complete') {
                            toastService.success(event.message || t('stats.syncComplete'));
                        } else if (event.type === 'error') {
                            toastService.error(event.message || t('stats.syncError'));
                        }
                    } catch {
                        // Skip malformed events from the stream.
                    }
                }
            }

            refreshCollection();
        } catch {
            toastService.error(t('stats.syncError'));
        } finally {
            setIsSyncing(false);
            setSyncProgress('');
        }
    };

    const formatCurrency = (value: number, currency: string) => {
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(value);
        } catch {
            return `$${value.toFixed(0)}`;
        }
    };

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
                <p className="text-base-content/60 mt-2">{t('stats.subtitle')}</p>
            </div>

            <CollectionStats stats={stats} desktopExpanded />

            {/* Evolution Graph Section */}
            {chartData.length > 0 && (
                <div className="bg-base-100 rounded-box shadow-lg p-4 md:p-6">
                    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl font-bold">{t('stats.evolutionTitle')}</h2>
                            <p className="text-lg font-semibold text-warning">
                                {t('stats.totalValue')}: {stats.totalValue > 0
                                    ? formatCurrency(stats.totalValue, stats.valueCurrency)
                                    : '—'}
                            </p>
                            {isSyncing && syncProgress && (
                                <p className="text-sm text-base-content/70">{syncProgress}</p>
                            )}
                        </div>
                        <button
                            className={`btn btn-sm btn-outline btn-primary gap-2 ${isSyncing ? 'loading' : ''}`}
                            onClick={handleSyncValues}
                            disabled={isSyncing}
                            title={t('stats.syncValues')}
                        >
                            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                            {t('stats.syncValues')}
                        </button>
                    </div>
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
                                    formatter={(value: any) => [`${value} ${stats.valueCurrency}`, t('stats.value')]}
                                    labelFormatter={(label) => `${t('stats.chartDateLabel')}: ${label}`}
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

            {showBlockerModal && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">{t('stats.syncInProgress')}</h3>
                        <p className="py-4">{t('stats.syncLeaveWarning')}</p>
                        {syncProgress && (
                            <p className="text-sm text-base-content/70 mb-2">{syncProgress}</p>
                        )}
                        <div className="modal-action">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowBlockerModal(false)}
                            >
                                {t('common.stay')}
                            </button>
                            <button
                                className="btn btn-warning"
                                onClick={() => {
                                    setShowBlockerModal(false);
                                    if (pendingHref) {
                                        navigate(pendingHref);
                                    }
                                }}
                            >
                                {t('common.leave')}
                            </button>
                        </div>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button onClick={() => setShowBlockerModal(false)}>close</button>
                    </form>
                </dialog>
            )}
        </div>
    );
};

export default StatsPage;
