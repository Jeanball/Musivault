import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionItem } from '../../../types/collection.types';
import { getItemValue } from '../../../utils/itemValue';
import { getImageUrl } from '../../../utils/imageUrl';
import { revealIfCached } from '../../../utils/imageReveal';
import FormatVerificationBadge from '../../Common/FormatVerificationBadge';
import FormatColorBadge from '../../Common/FormatColorBadge';
import { useCurrency } from '../../../hooks/useCurrency';

interface CollectionListViewProps {
    groupedItems: Record<string, CollectionItem[]>;
    onItemClick: (item: CollectionItem) => void;
}

/**
 * One table for the whole collection, with the artist as a band across it.
 *
 * Previously each artist got its own <table>, so every group sized its columns
 * independently and the album titles landed at a different x on each band. A
 * single table with fixed widths keeps every row on the same grid, and the
 * header only has to be read once.
 */
const CollectionListView: React.FC<CollectionListViewProps> = ({
    groupedItems,
    onItemClick
}) => {
    const { t } = useTranslation();
    const { formatValue } = useCurrency();

    return (
        <div className="overflow-x-auto">
            <table className="table table-fixed w-full min-w-176">
                <colgroup>
                    <col className="w-16" />
                    <col />
                    <col className="w-56" />
                    <col className="w-20" />
                    <col className="w-28" />
                </colgroup>
                <thead>
                    <tr>
                        <th>{t('album.cover')}</th>
                        <th>{t('common.album')}</th>
                        <th>{t('common.format')}</th>
                        <th>{t('common.year')}</th>
                        <th className="text-right">{t('stats.value')}</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(groupedItems).map(([artist, items]) => (
                        <React.Fragment key={artist}>
                            <tr className="bg-base-200">
                                <th colSpan={5} className="text-base font-bold text-base-content">
                                    {artist}
                                    <span className="ml-2 font-normal text-sm text-base-content/50">
                                        {items.length}
                                    </span>
                                </th>
                            </tr>
                            {items.map((item) => {
                                const value = getItemValue(item);
                                return (
                                    <tr
                                        key={item._id}
                                        onClick={() => onItemClick(item)}
                                        className="hover:bg-base-300 cursor-pointer"
                                    >
                                        <td>
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-base-300">
                                                <img
                                                    ref={revealIfCached}
                                                    src={getImageUrl(item.album.thumb || item.album.cover_image)}
                                                    alt=""
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                                                    onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="font-bold truncate" title={item.album.title}>
                                                {item.album.title}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-semibold truncate">{item.format.name}</span>
                                                <FormatVerificationBadge verification={item.formatVerification} />
                                            </div>
                                            {item.format.text && item.format.text !== item.format.name && (
                                                <div className="mt-1">
                                                    <FormatColorBadge
                                                        text={item.format.text}
                                                        maxChars={20}
                                                        className="text-xs min-h-5 py-0.5"
                                                        title={item.format.text}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                        <td className="tabular-nums">{item.album.year}</td>
                                        <td className="text-right tabular-nums">
                                            {value > 0 ? (
                                                <span className="font-semibold">
                                                    {formatValue(value)}
                                                </span>
                                            ) : (
                                                <span className="text-base-content/30">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CollectionListView;
