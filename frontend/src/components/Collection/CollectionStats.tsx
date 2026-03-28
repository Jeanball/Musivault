import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Disc, Layers, Calendar, Clock, Tag, ChevronDown, DollarSign, RefreshCw } from 'lucide-react';
import type { CollectionStats as CollectionStatsType } from '../../types/collection.types';
import { toastService } from '../../utils/toast';

interface CollectionStatsProps {
    stats: CollectionStatsType;
    onSyncComplete?: () => void;
}

const CollectionStats: React.FC<CollectionStatsProps> = ({ stats, onSyncComplete }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState<string>('');
    const [showBlockerModal, setShowBlockerModal] = useState(false);
    const [pendingHref, setPendingHref] = useState<string | null>(null);

    // Block browser close/refresh and in-app link clicks during sync
    useEffect(() => {
        if (!isSyncing) return;

        // Block browser tab close/refresh
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Intercept global link clicks
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const anchor = target.closest('a');
            
            // If it's a link and doesn't just point to an internal hash
            if (anchor && anchor.href && !anchor.href.includes('#')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Extract just the pathname + search + hash to use with react-router's navigate
                const url = new URL(anchor.href);
                setPendingHref(url.pathname + url.search + url.hash);
                setShowBlockerModal(true);
            }
        };

        // Use capture phase to intercept before React Router does
        document.documentElement.addEventListener('click', handleClick, true);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.documentElement.removeEventListener('click', handleClick, true);
        };
    }, [isSyncing]);

    const handleSyncValues = async (e: React.MouseEvent) => {
        e.stopPropagation();
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
                    } catch { /* skip malformed events */ }
                }
            }

            if (onSyncComplete) onSyncComplete();
        } catch (error) {
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
                currency: currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(value);
        } catch {
            return `$${value.toFixed(0)}`;
        }
    };

    return (
        <>
        <div className="bg-base-100 rounded-box shadow-lg mb-4">
            {/* Header with toggle button */}
            <div
                className="flex flex-col items-center justify-center p-3 md:p-4 cursor-pointer hover:bg-base-200 rounded-t-box gap-2"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 md:gap-3">
                    <h3 className="font-semibold text-base md:text-lg">{t('stats.title')}</h3>
                    <ChevronDown
                        size={20}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs md:text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Disc size={14} /> {stats.total}</span>
                    <span className="flex items-center gap-1"><Layers size={14} /> {Object.keys(stats.formatCounts).length}</span>
                    <span className="flex items-center gap-1"><Calendar size={14} /> {Object.keys(stats.decadeCounts).length}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {stats.recentAdds.thisWeek}</span>
                    <span className="flex items-center gap-1"><Tag size={14} /> {Object.keys(stats.styleCounts).length}</span>
                    {stats.totalValue > 0 && (
                        <span className="flex items-center gap-1 text-warning font-semibold">
                            <DollarSign size={14} /> {formatCurrency(stats.totalValue, stats.valueCurrency)}
                        </span>
                    )}
                </div>
            </div>

            {/* Collapsible content */}
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4">
                    {/* Total */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-primary mb-2 flex justify-center">
                            <Disc size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('stats.total')}</div>
                        <div className="text-2xl font-bold text-primary">{stats.total}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {stats.topArtist && `${stats.topArtist.name} (${stats.topArtist.count})`}
                        </div>
                    </div>

                    {/* Formats */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-secondary mb-2 flex justify-center">
                            <Layers size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('common.formats')}</div>
                        <div className="text-2xl font-bold text-secondary">{Object.keys(stats.formatCounts).length}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {Object.entries(stats.formatCounts)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 2)
                                .map(([format, count]) => `${format}: ${count}`)
                                .join(', ')}
                        </div>
                    </div>

                    {/* Decades */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-accent mb-2 flex justify-center">
                            <Calendar size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('stats.decades')}</div>
                        <div className="text-2xl font-bold text-accent">{Object.keys(stats.decadeCounts).length}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {Object.entries(stats.decadeCounts)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 2)
                                .map(([decade, count]) => `${decade}: ${count}`)
                                .join(', ')}
                        </div>
                    </div>

                    {/* Recent Adds */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-success mb-2 flex justify-center">
                            <Clock size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('stats.recent')}</div>
                        <div className="text-2xl font-bold text-success">{stats.recentAdds.thisWeek}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {t('stats.thisWeek')} • {stats.recentAdds.thisMonth} {t('stats.thisMonth')}
                        </div>
                    </div>

                    {/* Styles */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-info mb-2 flex justify-center">
                            <Tag size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('stats.styles')}</div>
                        <div className="text-2xl font-bold text-info">{Object.keys(stats.styleCounts).length}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {stats.topStyle && `${stats.topStyle.name} (${stats.topStyle.count})`}
                        </div>
                    </div>

                    {/* Collection Value */}
                    <div className="bg-base-200 rounded-lg p-4 text-center relative">
                        <div className="text-warning mb-2 flex justify-center">
                            <DollarSign size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('stats.value')}</div>
                        <div className="text-2xl font-bold text-warning">
                            {stats.totalValue > 0
                                ? formatCurrency(stats.totalValue, stats.valueCurrency)
                                : '—'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {isSyncing && syncProgress
                                ? syncProgress
                                : stats.itemsWithValue > 0
                                    ? `${stats.itemsWithValue}/${stats.total} ${t('stats.itemsValued')}`
                                    : t('stats.noValueYet')}
                        </div>
                        <button
                            className={`btn btn-xs btn-ghost mt-2 gap-1 ${isSyncing ? 'loading' : ''}`}
                            onClick={handleSyncValues}
                            disabled={isSyncing}
                            title={t('stats.syncValues')}
                        >
                            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                            {t('stats.syncValues')}
                        </button>
                    </div>
                </div>
            </div>
        </div>

            {/* Navigation blocker modal during sync */}
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
        </>
    );
};

export default CollectionStats;
