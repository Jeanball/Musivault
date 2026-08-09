import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DecadeChart from './DecadeChart';
import BarBreakdown, { type BarBreakdownEntry } from './BarBreakdown';
import type { CollectionStats } from '../../types/collection.types';

interface DistributionSectionProps {
    stats: CollectionStats;
}

/** Styles past this fold into a single "others" row rather than a long tail. */
const VISIBLE_STYLES = 8;

const byCountDesc = (a: BarBreakdownEntry, b: BarBreakdownEntry) => b.count - a.count;

const toEntries = (counts: Record<string, number>): BarBreakdownEntry[] =>
    Object.entries(counts).map(([name, count]) => ({ name, count })).sort(byCountDesc);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-base-100 rounded-box shadow-lg p-4 md:p-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
    </div>
);

/**
 * What the collection is actually made of.
 *
 * Replaces three tiles that counted distinct categories — "Formats: 5" says
 * nothing about a collection, the split does.
 */
const DistributionSection: React.FC<DistributionSectionProps> = ({ stats }) => {
    const { t } = useTranslation();

    const formats = useMemo(() => toEntries(stats.formatCounts), [stats.formatCounts]);

    const styles = useMemo(() => {
        const all = toEntries(stats.styleCounts);
        if (all.length <= VISIBLE_STYLES) return all;

        const shown = all.slice(0, VISIBLE_STYLES);
        const rest = all.slice(VISIBLE_STYLES);
        return [
            ...shown,
            {
                name: t('stats.otherStyles', { count: rest.length }),
                count: rest.reduce((sum, e) => sum + e.count, 0),
            },
        ];
    }, [stats.styleCounts, t]);

    // A style applies to several records at once, so its counts sum past the
    // collection size — the share has to be read against the records that carry
    // at least one style, not against every entry.
    const styleTotal = useMemo(
        () => Object.values(stats.styleCounts).reduce((sum, n) => sum + n, 0),
        [stats.styleCounts]
    );

    if (stats.total === 0) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="lg:col-span-2">
                <Panel title={t('stats.byDecade')}>
                    <DecadeChart decadeCounts={stats.decadeCounts} />
                </Panel>
            </div>

            {formats.length > 0 && (
                <Panel title={t('stats.byFormat')}>
                    <BarBreakdown entries={formats} total={stats.total} />
                </Panel>
            )}

            {styles.length > 0 && (
                <Panel title={t('stats.byStyle')}>
                    <BarBreakdown entries={styles} total={styleTotal} />
                </Panel>
            )}
        </div>
    );
};

export default DistributionSection;
