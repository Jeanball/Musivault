import { describe, it, expect } from 'vitest';
import type { CollectionItem } from '../../types/collection.types';
import { useCollectionStats } from './useCollectionStats';
import { renderHook } from '@testing-library/react';

const makeItem = (
    id: string,
    genres: string[],
    styles: string[],
    artist = 'Artist'
): CollectionItem => ({
    _id: id,
    album: {
        _id: `album-${id}`,
        title: `Album ${id}`,
        artist,
        year: '1990',
        thumb: '',
        cover_image: '',
        genres,
        styles
    },
    format: { name: 'Vinyl', descriptions: [], text: '' },
    addedAt: '2020-01-02T03:04:05.000Z'
});

describe('useCollectionStats genres', () => {
    it('counts broad Discogs genres apart from the styles', () => {
        const collection = [
            makeItem('1', ['Jazz', 'Fusion'], ['Modal Jazz']),
            makeItem('2', ['Jazz'], ['Bop'], 'Other Artist')
        ];

        const { result } = renderHook(() => useCollectionStats(collection));

        expect(result.current.genreCounts).toEqual({ Jazz: 2, Fusion: 1 });
        expect(result.current.availableGenres).toEqual(['Fusion', 'Jazz']);
        expect(result.current.styleCounts).toEqual({ 'Modal Jazz': 1, Bop: 1 });
    });

    it('offers no genres when the albums carry none', () => {
        const { result } = renderHook(() => useCollectionStats([makeItem('1', [], ['Rock'])]));

        expect(result.current.genreCounts).toEqual({});
        expect(result.current.availableGenres).toEqual([]);
    });
});
