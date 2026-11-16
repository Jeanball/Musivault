import type { SortColumn } from '../types/collection.types';
import type { CustomFieldDefinition } from '../types/customFields.types';

/** Prefix that marks a column backed by a user-defined custom field. */
export const CUSTOM_COLUMN_PREFIX = 'custom:';

export type BaseTableColumnKey =
    | 'cover'
    | 'artist'
    | 'album'
    | 'format'
    | 'label'
    | 'catalogNumber'
    | 'year'
    | 'genres'
    | 'addedAt'
    | 'price'
    | 'mediaCondition'
    | 'sleeveCondition';

export type TableColumnKey = BaseTableColumnKey | `custom:${string}`;

export interface BaseTableColumn {
    key: BaseTableColumnKey;
    /** Translation key for both the header and the picker entry. */
    labelKey: string;
    /** Used to keep the table readable when many columns are selected. */
    widthRem: number;
    /** Present only where the collection hook can actually sort. */
    sortKey?: SortColumn;
}

/** Order here is the order a normalised selection is rendered in. */
export const BASE_TABLE_COLUMNS: readonly BaseTableColumn[] = [
    { key: 'cover', labelKey: 'album.cover', widthRem: 5 },
    { key: 'artist', labelKey: 'common.artist', widthRem: 9, sortKey: 'artist' },
    { key: 'album', labelKey: 'common.album', widthRem: 11, sortKey: 'album' },
    { key: 'format', labelKey: 'common.format', widthRem: 5, sortKey: 'format' },
    { key: 'label', labelKey: 'album.label', widthRem: 9, sortKey: 'label' },
    { key: 'catalogNumber', labelKey: 'album.catalogNumber', widthRem: 7 },
    { key: 'year', labelKey: 'common.year', widthRem: 4, sortKey: 'year' },
    { key: 'genres', labelKey: 'album.styles', widthRem: 9 },
    { key: 'addedAt', labelKey: 'collection.added', widthRem: 6, sortKey: 'addedAt' },
    { key: 'price', labelKey: 'stats.value', widthRem: 6, sortKey: 'price' },
    { key: 'mediaCondition', labelKey: 'condition.media', widthRem: 5 },
    { key: 'sleeveCondition', labelKey: 'condition.sleeve', widthRem: 5 },
];

/** What the table showed before the columns became selectable. */
export const DEFAULT_TABLE_COLUMNS: readonly TableColumnKey[] = [
    'cover',
    'artist',
    'album',
    'format',
    'label',
    'year',
    'addedAt',
    'price',
];

const BASE_KEYS = new Set<string>(BASE_TABLE_COLUMNS.map((column) => column.key));
const BASE_ORDER = new Map<string, number>(
    BASE_TABLE_COLUMNS.map((column, index) => [column.key, index])
);
/** Fallback width for a custom column, and the bounds a field can ask for. */
export const CUSTOM_COLUMN_WIDTH_REM = 9;
export const CUSTOM_COLUMN_MIN_WIDTH_REM = 4;
export const CUSTOM_COLUMN_MAX_WIDTH_REM = 24;

export function isBaseTableColumn(key: string): key is BaseTableColumnKey {
    return BASE_KEYS.has(key);
}

export function isCustomTableColumn(key: string): key is `custom:${string}` {
    return key.startsWith(CUSTOM_COLUMN_PREFIX) && key.length > CUSTOM_COLUMN_PREFIX.length;
}

export function customColumnKey(fieldId: string): TableColumnKey {
    return `${CUSTOM_COLUMN_PREFIX}${fieldId}`;
}

/** The custom field id behind a column key, or null for a base column. */
export function customFieldIdFromColumn(key: string): string | null {
    return isCustomTableColumn(key) ? key.slice(CUSTOM_COLUMN_PREFIX.length) : null;
}

/**
 * Width of a column in rem. A custom field can carry its own width (set in
 * Settings); anything missing or out of range falls back to the shared default
 * and is clamped, so a bad value cannot push the table off screen.
 */
export function tableColumnWidthRem(
    key: TableColumnKey,
    customFields: readonly CustomFieldDefinition[] = []
): number {
    const base = BASE_TABLE_COLUMNS.find((column) => column.key === key);
    if (base) return base.widthRem;

    const fieldId = customFieldIdFromColumn(key);
    const stored = fieldId
        ? customFields.find((field) => field._id === fieldId)?.tableWidthRem
        : undefined;
    if (typeof stored !== 'number' || !Number.isFinite(stored)) return CUSTOM_COLUMN_WIDTH_REM;

    return Math.min(CUSTOM_COLUMN_MAX_WIDTH_REM, Math.max(CUSTOM_COLUMN_MIN_WIDTH_REM, stored));
}

/**
 * Keeps only columns that still exist (a custom field may have been deleted),
 * drops duplicates and restores the canonical order: base columns first, then
 * the user's custom fields in their own order.
 */
export function normalizeTableColumns(
    keys: readonly string[] | null | undefined,
    customFields: CustomFieldDefinition[]
): TableColumnKey[] {
    if (!keys || keys.length === 0) return [];

    const customOrder = new Map<string, number>(
        customFields.map((field, index) => [field._id, index])
    );
    const seen = new Set<string>();
    const valid: TableColumnKey[] = [];

    for (const key of keys) {
        if (typeof key !== 'string' || seen.has(key)) continue;

        if (isBaseTableColumn(key)) {
            seen.add(key);
            valid.push(key);
            continue;
        }

        const fieldId = customFieldIdFromColumn(key);
        if (!fieldId || !customOrder.has(fieldId)) continue;
        seen.add(key);
        valid.push(key as TableColumnKey);
    }

    return valid.sort((a, b) => {
        const aBase = BASE_ORDER.get(a);
        const bBase = BASE_ORDER.get(b);
        if (aBase !== undefined && bBase !== undefined) return aBase - bBase;
        if (aBase !== undefined) return -1;
        if (bBase !== undefined) return 1;

        const aCustom = customOrder.get(customFieldIdFromColumn(a) ?? '') ?? 0;
        const bCustom = customOrder.get(customFieldIdFromColumn(b) ?? '') ?? 0;
        return aCustom - bCustom;
    });
}

/**
 * Turns the stored preference into a renderable column list. An empty or stale
 * selection falls back to the historical columns, so the table is never blank.
 */
export function tableColumnsFromPreference(
    stored: readonly string[] | null | undefined,
    customFields: CustomFieldDefinition[]
): TableColumnKey[] {
    const valid = normalizeTableColumns(stored, customFields);
    return valid.length > 0 ? valid : [...DEFAULT_TABLE_COLUMNS];
}
