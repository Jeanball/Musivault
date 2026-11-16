import { beforeEach, describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { CollectionItem } from '../../types/collection.types';
import { useCollectionFilters } from './useCollectionFilters';

const makeItem = (id: string, genres: string[], styles: string[]): CollectionItem => ({
    _id: id,
    album: {
        _id: `album-${id}`,
        title: `Album ${id}`,
        artist: `Artist ${id}`,
        year: '1990',
        thumb: '',
        cover_image: '',
        genres,
        styles
    },
    format: { name: 'Vinyl', descriptions: [], text: '' },
    addedAt: '2020-01-02T03:04:05.000Z'
});

const collection = [
    makeItem('1', ['Jazz', 'Fusion'], ['Modal Jazz']),
    makeItem('2', ['Rock'], ['Alternative Rock']),
    makeItem('3', ['Jazz'], ['Bop'])
];

describe('useCollectionFilters genre', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('keeps only the albums carrying the chosen Discogs genre', () => {
        const { result } = renderHook(() => useCollectionFilters(collection, ''));

        act(() => {
            result.current.setFilters({ ...result.current.filters, genre: 'Jazz' });
        });

        expect(result.current.filteredCollection.map(item => item._id)).toEqual(['1', '3']);
    });

    it('filters by genre and style independently', () => {
        const { result } = renderHook(() => useCollectionFilters(collection, ''));

        act(() => {
            result.current.setFilters({ ...result.current.filters, genre: 'Jazz', style: 'Bop' });
        });

        expect(result.current.filteredCollection.map(item => item._id)).toEqual(['3']);
    });

    it('resets the genre with the other filters', () => {
        const { result } = renderHook(() => useCollectionFilters(collection, ''));

        act(() => {
            result.current.setFilters({ ...result.current.filters, genre: 'Jazz' });
            result.current.clearFilters();
        });

        expect(result.current.filters.genre).toBe('all');
        expect(result.current.filteredCollection).toHaveLength(collection.length);
    });
});
