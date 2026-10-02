import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLabelAggregation } from '../../../hooks/collection/useLabelAggregation';
import GroupedReleaseList from '../GroupedReleaseList';
import ListToolbar from '../ListToolbar';
import LabelLink from '../../Common/LabelLink';
import type { CollectionItem } from '../../../types/collection.types';

type LabelSort = 'releases' | 'name';

interface CollectionLabelsViewProps {
    collection: CollectionItem[];
    /** Typed in the toolbar, which keeps its place across the view modes. */
    searchTerm: string;
    onItemClick: (itemId: string) => void;
}

/**
 * The collection grouped by imprint, laid out like the tracks view because it is
 * the same shape: a named group, a count, and the records under it. A release
 * co-issued by two labels appears under both, so the per-label counts
 * legitimately sum past the collection size.
 */
const CollectionLabelsView: React.FC<CollectionLabelsViewProps> = ({ collection, searchTerm, onItemClick }) => {
    const { t } = useTranslation();
    const labels = useLabelAggregation(collection);
    const [expandedLabelId, setExpandedLabelId] = useState<string | null>(null);
    // Biggest imprints first: the shape of a collection is the point, and an
    // alphabetical list buries it.
    const [sortBy, setSortBy] = useState<LabelSort>('releases');

    const filteredLabels = useMemo(() => {
        const lower = searchTerm.trim().toLowerCase();
        const matching = lower ? labels.filter((label) => label.name.toLowerCase().includes(lower)) : labels;

        // The hook already orders by release count, which is the default here.
        if (sortBy === 'releases') return matching;
        return [...matching].sort((a, b) => a.name.localeCompare(b.name));
    }, [labels, searchTerm, sortBy]);

    return (
        <div className="space-y-4">
            <ListToolbar
                summary={t('labels.labelCount', { count: filteredLabels.length })}
                sortValue={sortBy}
                onSortChange={setSortBy}
                sortLabel={t('labels.sortBy')}
                options={[
                    { value: 'releases', label: t('labels.sortReleases') },
                    { value: 'name', label: t('labels.sortName') },
                ]}
            />

            {filteredLabels.length === 0 ? (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold">{t('labels.noLabelsFound')}</h2>
                    <p className="mt-2 text-base-content/70">{t('collection.tryAgain')}</p>
                </div>
            ) : (
                <GroupedReleaseList
                    groups={filteredLabels}
                    expandedId={expandedLabelId}
                    onToggle={(id) => setExpandedLabelId(expandedLabelId === id ? null : id)}
                    onSelect={onItemClick}
                    renderHeader={(label) => (
                        // stopPropagation so opening the label's card doesn't also
                        // toggle the group it sits in.
                        <div className="flex items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <LabelLink label={label.label} />
                            <span className="font-normal text-sm text-base-content/50 shrink-0">
                                {t('labels.releaseCount', { count: label.releaseCount })}
                            </span>
                        </div>
                    )}
                />
            )}
        </div>
    );
};

export default CollectionLabelsView;
