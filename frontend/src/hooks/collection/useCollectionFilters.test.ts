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

const makeSearchItem = (
    id: string,
    title: string,
    artist: string,
    album: Partial<CollectionItem['album']> = {}
): CollectionItem => {
    const item = makeItem(id, [], []);
    return { ...item, album: { ...item.album, title, artist, ...album } };
};

const searchCollection = [
    makeSearchItem('1', 'Kind of Blue', 'Miles Davis', {
        genres: ['Jazz'],
        styles: ['Hard Bop'],
        labels: [{ name: 'Columbia', catno: 'BLP 1577' }],
        tracklist: [{ position: '1', title: 'So What', duration: '9:22' }]
    }),
    makeSearchItem('2', 'Abbey Road', 'The Beatles', {
        genres: ['Rock'],
        styles: ['Psychedelic Rock']
    })
];

describe('useCollectionFilters free-text search', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('finds an album from incomplete words spread across several fields', () => {
        const { result } = renderHook(() => useCollectionFilters(searchCollection, 'mil dav kind blu'));

        expect(result.current.filteredCollection.map(item => item._id)).toEqual(['1']);
    });

    it('matches words in the artist, the tracklist, the genre and the style', () => {
        expect(renderHook(() => useCollectionFilters(searchCollection, 'davis so what')).result.current.filteredCollection.map(item => item._id)).toEqual(['1']);
        expect(renderHook(() => useCollectionFilters(searchCollection, 'jazz hard')).result.current.filteredCollection.map(item => item._id)).toEqual(['1']);
        expect(renderHook(() => useCollectionFilters(searchCollection, 'columbia 1577')).result.current.filteredCollection.map(item => item._id)).toEqual(['1']);
    });

    it('still finds another album with its own words', () => {
        const { result } = renderHook(() => useCollectionFilters(searchCollection, 'beatles abbey'));

        expect(result.current.filteredCollection.map(item => item._id)).toEqual(['2']);
    });

    it('applies OR between groups of words', () => {
        expect(renderHook(() => useCollectionFilters(searchCollection, 'miles davis OR abbey road')).result.current.filteredCollection.map(item => item._id)).toEqual(['1', '2']);
        expect(renderHook(() => useCollectionFilters(searchCollection, 'jazz or psychedelic')).result.current.filteredCollection.map(item => item._id)).toEqual(['1', '2']);
        expect(renderHook(() => useCollectionFilters(searchCollection, 'miles beatles OR xyz missing')).result.current.filteredCollection).toEqual([]);
    });

    it('requires every word to match, and shows everything when the query is empty', () => {
        expect(renderHook(() => useCollectionFilters(searchCollection, 'miles beatles')).result.current.filteredCollection).toEqual([]);
        expect(renderHook(() => useCollectionFilters(searchCollection, '   ')).result.current.filteredCollection).toHaveLength(2);
    });
});
