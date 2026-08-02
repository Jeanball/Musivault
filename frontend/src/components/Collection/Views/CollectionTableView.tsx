import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionItem, SortColumn, SortOrder } from '../../../types/collection.types';
import { getItemValue } from '../../../utils/itemValue';
import FormatVerificationBadge from '../../Common/FormatVerificationBadge';
import FormatColorBadge from '../../Common/FormatColorBadge';
import { useCurrency } from '../../../hooks/useCurrency';

interface CollectionTableViewProps {
    items: CollectionItem[];
    onItemClick: (item: CollectionItem) => void;
    onSort: (column: SortColumn) => void;
    getSortIcon: (column: SortColumn) => SortOrder | 'none';
}

const SortIcon: React.FC<{ state: SortOrder | 'none' }> = ({ state }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className="inline-block h-3.5 w-3.5 ml-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.25 9L12 5.25 15.75 9"
            className={state === 'asc' ? 'opacity-100' : 'opacity-30'}
        />
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.25 15L12 18.75 15.75 15"
            className={state === 'desc' ? 'opacity-100' : 'opacity-30'}
        />
    </svg>
);

const CollectionTableView: React.FC<CollectionTableViewProps> = ({
    items,
    onItemClick,
    onSort,
    getSortIcon
}) => {
    const { t } = useTranslation();
    const { formatValue } = useCurrency();
    return (
        <div className="overflow-x-auto">
            <table className="table w-full">
                <thead>
                    <tr>
                        <th>{t('album.cover')}</th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('artist')}
                        >
                            {t('common.artist')} <SortIcon state={getSortIcon('artist')} />
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('album')}
                        >
                            {t('common.album')} <SortIcon state={getSortIcon('album')} />
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('format')}
                        >
                            {t('common.format')} <SortIcon state={getSortIcon('format')} />
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('label')}
                        >
                            {t('album.label')} <SortIcon state={getSortIcon('label')} />
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('year')}
                        >
                            {t('common.year')} <SortIcon state={getSortIcon('year')} />
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('addedAt')}
                        >
                            {t('collection.added')} <SortIcon state={getSortIcon('addedAt')} />
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('price')}
                        >
                            {t('stats.value')} <SortIcon state={getSortIcon('price')} />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item._id}
                            onClick={() => onItemClick(item)}
                            className="hover cursor-pointer"
                        >
                            <td>
                                <div className="avatar">
                                    <div className="w-12 h-12 rounded-lg">
                                        <img
                                            src={item.album.thumb || item.album.cover_image}
                                            alt={item.album.title}
                                            loading="lazy"
                                        />
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div className="font-bold">{item.album.artist}</div>
                            </td>
                            <td>
                                <div className="font-semibold">{item.album.title}</div>
                            </td>
                            <td>
                                <div className="flex items-center gap-2">
                                    <div className="badge badge-secondary">{item.format.name}</div>
                                    <FormatVerificationBadge verification={item.formatVerification} />
                                </div>
                                {item.format.text && item.format.text !== item.format.name && (
                                    <div className="mt-1.5">
                                        <FormatColorBadge
                                            text={item.format.text}
                                            className="text-xs min-h-5 py-0.5"
                                            title={item.format.text}
                                        />
                                    </div>
                                )}
                            </td>
                            <td>
                                {item.album.labels?.[0]?.name ? (
                                    <span className="text-sm">{item.album.labels[0].name}</span>
                                ) : (
                                    <span className="text-base-content/30">—</span>
                                )}
                            </td>
                            <td>{item.album.year || t('common.na')}</td>
                            <td>{new Date(item.addedAt).toLocaleDateString('en-US')}</td>
                            <td>
                                {(() => {
                                    const val = getItemValue(item);
                                    return val > 0 ? (
                                        <span className="font-semibold text-warning">
                                            {formatValue(val)}
                                        </span>
                                    ) : (
                                        <span className="text-base-content/30">—</span>
                                    );
                                })()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CollectionTableView;
