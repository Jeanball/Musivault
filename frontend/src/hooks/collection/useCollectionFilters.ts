import { useState, useMemo, useEffect } from 'react';
import type { CollectionItem, FilterState } from '../../types/collection.types';

const FILTER_STORAGE_KEY = 'musivault_collection_filters';
const DEFAULT_FILTERS: FilterState = {
    format: 'all',
    decade: 'all',
    addedPeriod: 'all',
    style: 'all',
    issueStatus: 'all'
};

const getInitialFilters = (): FilterState => {
    try {
        const stored = sessionStorage.getItem(FILTER_STORAGE_KEY);
        if (stored) {
            return {
                ...DEFAULT_FILTERS,
                ...JSON.parse(stored)
            };
        }
    } catch (e) {
        // Ignore parse errors
    }
    return DEFAULT_FILTERS;
};

export const useCollectionFilters = (collection: CollectionItem[], searchTerm: string) => {
    const [filters, setFilters] = useState<FilterState>(getInitialFilters);
    const normalizedSearchTerm = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

    // Persist filters to sessionStorage
    useEffect(() => {
        sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    }, [filters]);

    const filteredCollection = useMemo(() => {
        const hasSearchTerm = normalizedSearchTerm.length > 0;
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);

        return collection.filter(item => {
            if (hasSearchTerm) {
                const matchesTitle = item.album.title.toLowerCase().includes(normalizedSearchTerm);
                const matchesArtist = item.album.artist.toLowerCase().includes(normalizedSearchTerm);
                const matchesTrack = !matchesTitle && !matchesArtist
                    ? item.album.tracklist?.some(track =>
                        track.title.toLowerCase().includes(normalizedSearchTerm) ||
                        (track.artist && track.artist.toLowerCase().includes(normalizedSearchTerm))
                    ) || false
                    : false;

                if (!matchesTitle && !matchesArtist && !matchesTrack) {
                    return false;
                }
            }

            if (filters.format !== 'all' && item.format.name !== filters.format) {
                return false;
            }

            if (filters.decade !== 'all') {
                const year = Number.parseInt(item.album.year, 10);
                if (year) {
                    const decade = Math.floor(year / 10) * 10;
                    if (`${decade}s` !== filters.decade) {
                        return false;
                    }
                } else if (filters.decade !== 'unknown') {
                    return false;
                }
            }

            if (filters.style !== 'all' && (!item.album.styles || !item.album.styles.includes(filters.style))) {
                return false;
            }

            if (filters.issueStatus === 'issues' && (!item.formatVerification || item.formatVerification.status === 'match')) {
                return false;
            }

            if (filters.addedPeriod !== 'all') {
                const addedDate = new Date(item.addedAt);

                switch (filters.addedPeriod) {
                    case 'thisWeek':
                        if (addedDate < weekAgo) return false;
                        break;
                    case 'thisMonth':
                        if (addedDate < monthStart) return false;
                        break;
                    case 'thisYear':
                        if (addedDate < yearStart) return false;
                        break;
                    case 'lastYear':
                        if (addedDate < lastYearStart || addedDate > lastYearEnd) return false;
                        break;
                }
            }

            return true;
        });
    }, [collection, filters, normalizedSearchTerm]);

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
        setFilters(DEFAULT_FILTERS);
    };

    return {
        filters,
        setFilters,
        clearFilters,
        filteredCollection,
        groupedByArtist
    };
};
