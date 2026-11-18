import { describe, expect, it } from 'vitest';
import type { CustomFieldDefinition } from '../types/customFields.types';
import {
    DEFAULT_TABLE_COLUMNS,
    customColumnKey,
    normalizeTableColumns,
    tableColumnsFromPreference,
    tableColumnWidthRem,
} from './tableColumns';

const field = (id: string, name: string, order: number): CustomFieldDefinition => ({
    _id: id,
    name,
    type: 'text',
    order,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
});

const binder = field('field-binder', 'Binder', 0);
const location = field('field-location', 'Location', 1);
const customFields = [binder, location];

describe('table columns', () => {
    it('falls back to the historical columns when nothing is stored', () => {
        expect(tableColumnsFromPreference(undefined, [])).toEqual([...DEFAULT_TABLE_COLUMNS]);
        expect(tableColumnsFromPreference([], [])).toEqual([...DEFAULT_TABLE_COLUMNS]);
    });

    it('falls back to the defaults when every stored column has disappeared', () => {
        expect(tableColumnsFromPreference([customColumnKey('deleted')], customFields))
            .toEqual([...DEFAULT_TABLE_COLUMNS]);
    });

    it('keeps the canonical order whatever order the selection was saved in', () => {
        expect(normalizeTableColumns(['price', 'artist', 'cover', 'album'], [])).toEqual([
            'cover',
            'artist',
            'album',
            'price',
        ]);
    });

    it('drops unknown keys and duplicates', () => {
        expect(normalizeTableColumns(['artist', 'artist', 'nope', 'year'], [])).toEqual([
            'artist',
            'year',
        ]);
    });

    it('keeps custom columns after the base ones, in custom-field order', () => {
        expect(
            normalizeTableColumns(
                [customColumnKey(location._id), 'artist', customColumnKey(binder._id)],
                customFields
            )
        ).toEqual(['artist', customColumnKey(binder._id), customColumnKey(location._id)]);
    });

    it('drops a custom column whose field no longer exists', () => {
        expect(
            normalizeTableColumns(['artist', customColumnKey('deleted'), customColumnKey(binder._id)], customFields)
        ).toEqual(['artist', customColumnKey(binder._id)]);
    });

    it('gives base columns their own width and custom columns their configured one', () => {
        expect(tableColumnWidthRem('cover')).toBe(5);
        expect(tableColumnWidthRem('format')).toBe(5);
        expect(tableColumnWidthRem(customColumnKey(binder._id))).toBe(9);
        expect(tableColumnWidthRem(customColumnKey(binder._id), customFields)).toBe(9);

        const narrow = { ...binder, tableWidthRem: 6 };
        const wide = { ...location, tableWidthRem: 99 };
        expect(tableColumnWidthRem(customColumnKey(narrow._id), [narrow])).toBe(6);
        // A stored value outside the allowed range is clamped.
        expect(tableColumnWidthRem(customColumnKey(wide._id), [wide])).toBe(24);
    });
});
