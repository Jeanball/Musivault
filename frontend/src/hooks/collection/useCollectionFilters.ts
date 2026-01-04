import { useState, useMemo, useEffect } from 'react';
import type { CollectionItem, FilterState } from '../../types/collection.types';

const FILTER_STORAGE_KEY = 'musivault_collection_filters';

const getInitialFilters = (): FilterState => {
    try {
        const stored = sessionStorage.getItem(FILTER_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        // Ignore parse errors
    }
    return {
        format: 'all',
        decade: 'all',
        addedPeriod: 'all',
        style: 'all'
    };
};

export const useCollectionFilters = (collection: CollectionItem[], searchTerm: string) => {
    const [filters, setFilters] = useState<FilterState>(getInitialFilters);

    // Persist filters to sessionStorage
    useEffect(() => {
        sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    }, [filters]);

    const applyFilters = (items: CollectionItem[]) => {
        return items.filter(item => {
            // Filter by text search
            const term = searchTerm.toLowerCase();
            const matchesTitle = item.album.title.toLowerCase().includes(term);
            const matchesArtist = item.album.artist.toLowerCase().includes(term);
            const matchesTrack = item.album.tracklist?.some(track =>
                track.title.toLowerCase().includes(term) ||
                (track.artist && track.artist.toLowerCase().includes(term))
            ) || false;
            const matchesSearch = matchesTitle || matchesArtist || matchesTrack;

            if (!matchesSearch) return false;

            // Filter by format
            if (filters.format !== 'all' && item.format.name !== filters.format) {
                return false;
            }

            // Filter by decade
            if (filters.decade !== 'all') {
                const year = parseInt(item.album.year);
                if (year) {
                    const decade = Math.floor(year / 10) * 10;
                    const decadeLabel = `${decade}s`;
                    if (decadeLabel !== filters.decade) return false;
                } else if (filters.decade !== 'unknown') {
                    return false;
                }
            }

            // Filter by style
            if (filters.style !== 'all') {
                if (!item.album.styles || !item.album.styles.includes(filters.style)) {
                    return false;
                }
            }

            // Filter by added period
            if (filters.addedPeriod !== 'all') {
                const addedDate = new Date(item.addedAt);
                const now = new Date();

                switch (filters.addedPeriod) {
                    case 'thisWeek':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (addedDate < weekAgo) return false;
                        break;
                    case 'thisMonth':
                        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                        if (addedDate < monthStart) return false;
                        break;
                    case 'thisYear':
                        const yearStart = new Date(now.getFullYear(), 0, 1);
                        if (addedDate < yearStart) return false;
                        break;
                    case 'lastYear':
                        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
                        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
                        if (addedDate < lastYearStart || addedDate > lastYearEnd) return false;
                        break;
                }
            }

            return true;
        });
    };

    const filteredCollection = useMemo(() => {
        return applyFilters(collection);
    }, [collection, searchTerm, filters]);

    const groupedByArtist = useMemo(() => {
        return filteredCollection.reduce((acc, item) => {
            const artist = item.album.artist;
            if (!acc[artist]) {
                acc[artist] = [];
            }
            acc[artist].push(item);
            return acc;
        }, {} as Record<string, CollectionItem[]>);
    }, [filteredCollection]);

    const clearFilters = () => {
        setFilters({
            format: 'all',
            decade: 'all',
            addedPeriod: 'all',
            style: 'all'
        });
    };

    return {
        filters,
        setFilters,
        clearFilters,
        filteredCollection,
        groupedByArtist
    };
};
