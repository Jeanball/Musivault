import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionItem, SortColumn, SortOrder } from '../../../types/collection.types';
import type { CustomFieldDefinition } from '../../../types/customFields.types';
import { getItemValue } from '../../../utils/itemValue';
import { stripDiscogsSuffix } from '../../../utils/formatters';
import { normalizeCustomFieldValues } from '../../../utils/customFields';
import {
    BASE_TABLE_COLUMNS,
    customFieldIdFromColumn,
    isCustomTableColumn,
    tableColumnWidthRem,
    type TableColumnKey,
} from '../../../constants/tableColumns';
import FormatVerificationBadge from '../../Common/FormatVerificationBadge';
import FormatColorBadge from '../../Common/FormatColorBadge';
import { useCurrency } from '../../../hooks/useCurrency';

interface CollectionTableViewProps {
    items: CollectionItem[];
    onItemClick: (item: CollectionItem) => void;
    onSort: (column: SortColumn) => void;
    getSortIcon: (column: SortColumn) => SortOrder | 'none';
    /** What to draw, in order. Comes from the user's saved preferences. */
    columns: TableColumnKey[];
    /** Only the definitions still present on this instance become custom columns. */
    customFields: CustomFieldDefinition[];
}

const SortIcon: React.FC<{ state: SortOrder | 'none' }> = ({ state }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        className="inline-block h-3.5 w-3.5 ml-0.5 shrink-0"
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

const EmptyCell: React.FC = () => <span className="text-base-content/30">—</span>;

const CollectionTableView: React.FC<CollectionTableViewProps> = ({
    items,
    onItemClick,
    onSort,
    getSortIcon,
    columns,
    customFields
}) => {
    const { t, i18n } = useTranslation();
    const { formatValue } = useCurrency();

    const customFieldNames = new Map(customFields.map((field) => [field._id, field.name]));
    const hasCustomColumns = columns.some(isCustomTableColumn);
    const tableWidthRem = columns.reduce((sum, key) => sum + tableColumnWidthRem(key), 0);

    const renderHeader = (key: TableColumnKey) => {
        const customFieldId = customFieldIdFromColumn(key);
        const baseColumn = BASE_TABLE_COLUMNS.find((column) => column.key === key);

        if (customFieldId) {
            const name = customFieldNames.get(customFieldId) ?? '';
            return (
                <th key={key}>
                    <span className="block truncate" title={name}>{name}</span>
                </th>
            );
        }

        const label = t(baseColumn?.labelKey ?? '');
        const sortKey = baseColumn?.sortKey;
        if (!sortKey) {
            return <th key={key}>{label}</th>;
        }

        return (
            <th
                key={key}
                className="cursor-pointer hover:bg-base-200"
                onClick={() => onSort(sortKey)}
            >
                {label} <SortIcon state={getSortIcon(sortKey)} />
            </th>
        );
    };

    const renderCell = (item: CollectionItem, key: TableColumnKey) => {
        switch (key) {
            case 'cover':
                return (
                    <div className="w-12 h-12 rounded-field overflow-hidden bg-base-300">
                        <img
                            src={item.album.thumb || item.album.cover_image}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                        />
                    </div>
                );
            case 'artist':
                return (
                    <div className="font-bold truncate" title={item.album.artist}>
                        {item.album.artist}
                    </div>
                );
            case 'album':
                return (
                    <div className="font-semibold truncate" title={item.album.title}>
                        {item.album.title}
                    </div>
                );
            case 'format':
                return (
                    <>
                        <div className="flex items-center gap-2">
                            <div className="badge badge-secondary">{item.format.name}</div>
                            <FormatVerificationBadge verification={item.formatVerification} />
                        </div>
                        {item.format.text && item.format.text !== item.format.name && (
                            <div className="mt-1.5">
                                <FormatColorBadge
                                    text={item.format.text}
                                    maxChars={20}
                                    className="text-xs min-h-5 py-0.5"
                                    title={item.format.text}
                                />
                            </div>
                        )}
                    </>
                );
            case 'label': {
                const label = item.album.labels?.[0]?.name;
                return label ? (
                    <span className="text-sm truncate block" title={label}>
                        {stripDiscogsSuffix(label)}
                    </span>
                ) : (
                    <EmptyCell />
                );
            }
            case 'catalogNumber': {
                const catalogNumber = item.album.labels?.[0]?.catno;
                return catalogNumber ? (
                    <span className="text-sm truncate block tabular-nums" title={catalogNumber}>
                        {catalogNumber}
                    </span>
                ) : (
                    <EmptyCell />
                );
            }
            case 'year':
                return <span className="tabular-nums">{item.album.year || t('common.na')}</span>;
            case 'genres': {
                const genres = item.album.styles?.filter(Boolean) ?? [];
                return genres.length > 0 ? (
                    <span className="text-sm truncate block" title={genres.join(', ')}>
                        {genres.join(', ')}
                    </span>
                ) : (
                    <EmptyCell />
                );
            }
            case 'addedAt':
                return (
                    <span className="tabular-nums">
                        {new Date(item.addedAt).toLocaleDateString(i18n.language)}
                    </span>
                );
            case 'price': {
                const value = getItemValue(item);
                return value > 0 ? (
                    <span className="font-semibold">{formatValue(value)}</span>
                ) : (
                    <EmptyCell />
                );
            }
            case 'mediaCondition':
                return item.mediaCondition ? (
                    <span className="badge badge-ghost badge-sm">{item.mediaCondition}</span>
                ) : (
                    <EmptyCell />
                );
            case 'sleeveCondition':
                return item.sleeveCondition ? (
                    <span className="badge badge-ghost badge-sm">{item.sleeveCondition}</span>
                ) : (
                    <EmptyCell />
                );
            default: {
                const fieldId = customFieldIdFromColumn(key);
                const value = fieldId && hasCustomColumns
                    ? normalizeCustomFieldValues(item.customFields)[fieldId]
                    : '';
                return value ? (
                    <span className="text-sm truncate block" title={value}>{value}</span>
                ) : (
                    <EmptyCell />
                );
            }
        }
    };

    return (
        <div className="overflow-x-auto">
            {/* table-fixed with an explicit colgroup: left to itself the browser
                re-measures every column from its content, so a long format or label
                shifted the whole row out of line with its neighbours. */}
            <table className="table table-fixed w-full" style={{ minWidth: `${tableWidthRem}rem` }}>
                <colgroup>
                    {columns.map((key) => (
                        <col key={key} style={{ width: `${tableColumnWidthRem(key)}rem` }} />
                    ))}
                </colgroup>
                <thead>
                    <tr>{columns.map(renderHeader)}</tr>
                </thead>
                <tbody>
                    {items.map((item) => (
                        <tr
                            key={item._id}
                            onClick={() => onItemClick(item)}
                            className="group hover:bg-base-300 cursor-pointer"
                        >
                            {columns.map((key) => (
                                <td key={key}>{renderCell(item, key)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CollectionTableView;
