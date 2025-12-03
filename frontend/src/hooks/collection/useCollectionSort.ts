import { useState, useMemo } from 'react';
import type { CollectionItem, SortColumn, SortOrder } from '../../types/collection';

export const useCollectionSort = (filteredCollection: CollectionItem[]) => {
    const [sortBy, setSortBy] = useState<SortColumn>('artist');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const handleSort = (column: SortColumn) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const getSortIcon = (column: SortColumn) => {
        if (sortBy !== column) return '↕️';
        return sortOrder === 'asc' ? '↑' : '↓';
    };

    const sortedCollection = useMemo(() => {
        return [...filteredCollection].sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            switch (sortBy) {
                case 'artist':
                    aValue = a.album.artist.toLowerCase();
                    bValue = b.album.artist.toLowerCase();
                    break;
                case 'album':
                    aValue = a.album.title.toLowerCase();
                    bValue = b.album.title.toLowerCase();
                    break;
                case 'year':
                    aValue = parseInt(a.album.year) || 0;
                    bValue = parseInt(b.album.year) || 0;
                    break;
                case 'format':
                    aValue = a.format.name.toLowerCase();
                    bValue = b.format.name.toLowerCase();
                    break;
                case 'addedAt':
                    aValue = new Date(a.addedAt).getTime();
                    bValue = new Date(b.addedAt).getTime();
                    break;
                default:
                    return 0;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                const comparison = aValue.localeCompare(bValue);
                return sortOrder === 'asc' ? comparison : -comparison;
            } else {
                const comparison = (aValue as number) - (bValue as number);
                return sortOrder === 'asc' ? comparison : -comparison;
            }
        });
    }, [filteredCollection, sortBy, sortOrder]);

    return {
        sortBy,
        sortOrder,
        handleSort,
        getSortIcon,
        sortedCollection
    };
};
