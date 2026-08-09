import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../hooks/useCurrency';
import type { CollectionStats } from '../../types/collection.types';

interface StatsKpiRowProps {
    stats: CollectionStats;
}

interface TileProps {
    label: string;
    value: string;
    /** One line qualifying the number above — never decoration. */
    detail?: string;
}

const Tile: React.FC<TileProps> = ({ label, value, detail }) => (
    <div className="bg-base-200 rounded-box p-4 flex flex-col gap-1 overflow-hidden">
        <div className="text-xs text-base-content/50 uppercase tracking-wide truncate">{label}</div>
        {/* A formatted total runs long — "$12,345.67" at text-3xl overflows a
            half-width tile on a phone. The figure steps down with the viewport
            instead, and truncate is only the guard for absurd amounts. */}
        <div
            className="text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums leading-none truncate"
            title={value}
        >
            {value}
        </div>
        {detail && <div className="text-xs text-base-content/60 truncate" title={detail}>{detail}</div>}
    </div>
);

/**
 * The headline numbers. Deliberately no oversized icons: they used to outweigh
 * the figures they decorated, and every tile here has a real detail line to earn
 * that space instead.
 */
const StatsKpiRow: React.FC<StatsKpiRowProps> = ({ stats }) => {
    const { t } = useTranslation();
    const { formatValue } = useCurrency();

    const artistCount = Object.keys(stats.artistCounts).length;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile
                label={t('stats.records')}
                value={stats.total.toLocaleString()}
                detail={stats.topArtist
                    ? t('stats.topArtistDetail', { name: stats.topArtist.name, count: stats.topArtist.count })
                    : undefined}
            />
            <Tile
                label={t('stats.totalValue')}
                // No input currency: stored prices are USD and formatValue
                // converts once, the same way the chart and the collection views
                // do. Passing another base here made this tile disagree with the
                // curve right below it.
                value={stats.totalValue > 0 ? formatValue(stats.totalValue) : '—'}
                // A total with no coverage is misleading: knowing it covers 31 of
                // 412 records is the difference between a figure and a guess.
                detail={t('stats.pricedCoverage', {
                    priced: stats.itemsWithValue,
                    total: stats.total,
                })}
            />
            <Tile
                label={t('stats.artists')}
                value={artistCount.toLocaleString()}
                detail={stats.total > 0
                    ? t('stats.recordsPerArtist', { n: (stats.total / Math.max(artistCount, 1)).toFixed(1) })
                    : undefined}
            />
            <Tile
                label={t('stats.addedThisMonth')}
                value={stats.recentAdds.thisMonth.toLocaleString()}
                detail={t('stats.addedThisWeek', { count: stats.recentAdds.thisWeek })}
            />
        </div>
    );
};

export default StatsKpiRow;
