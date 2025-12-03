import { useState, useMemo } from 'react';
import type { CollectionItem, FilterState } from '../../types/collection';

export const useCollectionFilters = (collection: CollectionItem[], searchTerm: string) => {
    const [filters, setFilters] = useState<FilterState>({
        format: 'all',
        decade: 'all',
        addedPeriod: 'all'
    });

    const applyFilters = (items: CollectionItem[]) => {
        return items.filter(item => {
            // Filtre par recherche textuelle
            const term = searchTerm.toLowerCase();
            const matchesSearch = item.album.title.toLowerCase().includes(term) || 
                                item.album.artist.toLowerCase().includes(term);
            
            if (!matchesSearch) return false;

            // Filtre par format
            if (filters.format !== 'all' && item.format.name !== filters.format) {
                return false;
            }

            // Filtre par décennie
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

            // Filtre par période d'ajout
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

    return {
        filters,
        setFilters,
        filteredCollection,
        groupedByArtist
    };
};
