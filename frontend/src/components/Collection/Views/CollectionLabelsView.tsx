import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLabelAggregation } from '../../../hooks/collection/useLabelAggregation';
import LabelLink from '../../Common/LabelLink';
import type { CollectionItem } from '../../../types/collection.types';
import { getImageUrl } from '../../../utils/imageUrl';
import { revealIfCached } from '../../../utils/imageReveal';

interface CollectionLabelsViewProps {
    collection: CollectionItem[];
    onItemClick: (itemId: string) => void;
}

/**
 * The collection grouped by imprint, laid out like the list view: one table, one
 * header, a band per label. A release co-issued by two labels appears under both,
 * so the per-label counts legitimately sum past the collection size.
 */
const CollectionLabelsView: React.FC<CollectionLabelsViewProps> = ({ collection, onItemClick }) => {
    const { t } = useTranslation();
    const labels = useLabelAggregation(collection);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLabels = useMemo(() => {
        if (!searchTerm.trim()) return labels;
        const lower = searchTerm.toLowerCase();
        return labels.filter((label) => label.name.toLowerCase().includes(lower));
    }, [labels, searchTerm]);

    return (
        <div className="space-y-4">
            <input
                type="search"
                placeholder={t('labels.searchLabel')}
                className="input w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="text-sm text-base-content/60">
                {t('labels.labelCount', { count: filteredLabels.length })}
            </div>

            {filteredLabels.length === 0 ? (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold">{t('labels.noLabelsFound')}</h2>
                    <p className="mt-2 text-base-content/70">{t('collection.tryAgain')}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="table table-fixed w-full min-w-176">
                        <colgroup>
                            <col className="w-16" />
                            <col />
                            <col className="w-56" />
                            <col className="w-36" />
                            <col className="w-20" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>{t('album.cover')}</th>
                                <th>{t('common.album')}</th>
                                <th>{t('common.artist')}</th>
                                <th>{t('album.catalogNumber')}</th>
                                <th>{t('common.year')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLabels.map((label) => (
                                <React.Fragment key={label.id}>
                                    <tr className="bg-base-200">
                                        <th colSpan={5} className="text-base font-bold text-base-content">
                                            <div className="flex items-center gap-3">
                                                <LabelLink label={label.label} />
                                                <span className="font-normal text-sm text-base-content/50">
                                                    {t('labels.releaseCount', { count: label.releaseCount })}
                                                </span>
                                            </div>
                                        </th>
                                    </tr>
                                    {label.releases.map((release) => (
                                        <tr
                                            key={release.collectionItemId}
                                            onClick={() => onItemClick(release.collectionItemId)}
                                            className="hover:bg-base-300 cursor-pointer"
                                        >
                                            <td>
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-base-300">
                                                    <img
                                                        ref={revealIfCached}
                                                        src={getImageUrl(release.thumb || release.cover_image)}
                                                        alt=""
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                                                        onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <div className="font-bold truncate" title={release.title}>
                                                    {release.title}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="truncate" title={release.artist}>
                                                    {release.artist}
                                                </div>
                                            </td>
                                            <td>
                                                {release.catno ? (
                                                    <span className="font-mono text-xs text-base-content/70">
                                                        {release.catno}
                                                    </span>
                                                ) : (
                                                    <span className="text-base-content/30">—</span>
                                                )}
                                            </td>
                                            <td className="tabular-nums">{release.year || '—'}</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CollectionLabelsView;
