import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CollectionTableView from './CollectionTableView';
import type { CollectionItem } from '../../../types/collection.types';
import type { CustomFieldDefinition } from '../../../types/customFields.types';
import type { TableColumnKey } from '../../../constants/tableColumns';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en' },
    }),
}));

vi.mock('../../../hooks/useCurrency', () => ({
    useCurrency: () => ({ formatValue: (value: number) => `$${value}` }),
}));

const binder: CustomFieldDefinition = {
    _id: 'field-binder',
    name: 'Binder',
    type: 'text',
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
};

const item: CollectionItem = {
    _id: 'item-1',
    album: {
        _id: 'album-1',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        cover_image: '',
        thumb: '',
        year: '1959',
        styles: ['Jazz', 'Modal'],
        labels: [{ name: 'Columbia', catno: 'CL 1355' }],
    },
    format: { name: 'Vinyl', descriptions: [], text: '' },
    customFields: { 'field-binder': 'Shelf A' },
    addedAt: '2024-01-02T00:00:00.000Z',
};

const renderTable = (columns: TableColumnKey[]) =>
    render(
        <CollectionTableView
            items={[item]}
            onItemClick={vi.fn()}
            onSort={vi.fn()}
            getSortIcon={() => 'none'}
            columns={columns}
            customFields={[binder]}
        />
    );

describe('CollectionTableView columns', () => {
    it('draws only the selected base columns', () => {
        renderTable(['artist', 'album']);

        expect(screen.getByText('common.artist')).toBeInTheDocument();
        expect(screen.getByText('common.album')).toBeInTheDocument();
        expect(screen.queryByText('stats.value')).not.toBeInTheDocument();
        expect(screen.queryByText('album.cover')).not.toBeInTheDocument();
    });

    it('can add catalog number, genres and a custom field as columns', () => {
        renderTable(['artist', 'catalogNumber', 'genres', 'custom:field-binder']);

        expect(screen.getByText('album.catalogNumber')).toBeInTheDocument();
        expect(screen.getByText('CL 1355')).toBeInTheDocument();
        expect(screen.getByText('common.genres')).toBeInTheDocument();
        expect(screen.getByText('Jazz, Modal')).toBeInTheDocument();
        expect(screen.getByText('Binder')).toBeInTheDocument();
        expect(screen.getByText('Shelf A')).toBeInTheDocument();
    });
});
