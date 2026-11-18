import { useState, useMemo, useEffect } from 'react';
import type { CollectionItem, FilterState } from '../../types/collection.types';
import { hasActiveFormatVerificationIssue } from '../../utils/formatVerification';
import { stripDiscogsSuffix } from '../../utils/formatters';
import { getSearchTermGroups, matchesSearchGroups } from '../../utils/search';

const FILTER_STORAGE_KEY = 'musivault_collection_filters';
const DEFAULT_FILTERS: FilterState = {
    format: 'all',
    decade: 'all',
    addedPeriod: 'all',
    genre: 'all',
    style: 'all',
    label: 'all',
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
    } catch {
        // Ignore parse errors
    }
    return DEFAULT_FILTERS;
};

export const useCollectionFilters = (collection: CollectionItem[], searchTerm: string) => {
    const [filters, setFilters] = useState<FilterState>(getInitialFilters);
    const searchTermGroups = useMemo(() => getSearchTermGroups(searchTerm), [searchTerm]);

    // Persist filters to sessionStorage
    useEffect(() => {
        sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    }, [filters]);

    const filteredCollection = useMemo(() => {
        const hasSearchTerm = searchTermGroups.length > 0;
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);

        return collection.filter(item => {
            if (hasSearchTerm && !matchesSearchGroups(searchTermGroups, [
                item.album.title,
                item.album.artist,
                item.album.year,
                item.format.name,
                ...(item.album.genres || []),
                ...(item.album.styles || []),
                ...(item.album.labels || []).flatMap(label => [label.name, label.catno]),
                ...(item.album.tracklist || []).flatMap(track => [track.title, track.artist]),
            ])) {
                return false;
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

            if (filters.genre !== 'all' && (!item.album.genres || !item.album.genres.includes(filters.genre))) {
                return false;
            }

            if (filters.style !== 'all' && (!item.album.styles || !item.album.styles.includes(filters.style))) {
                return false;
            }

            // Compared stripped on both sides: the dropdown lists the cleaned
            // names, so a raw "Columbia (2)" release must still match "Columbia".
            if (filters.label !== 'all' && !item.album.labels?.some(l => stripDiscogsSuffix(l.name) === filters.label)) {
                return false;
            }

            if (filters.issueStatus === 'issues' && !hasActiveFormatVerificationIssue(item.formatVerification)) {
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
    }, [collection, filters, searchTermGroups]);

    const groupedByArtist = useMemo(() => {
        const grouped = filteredCollection.reduce((acc, item) => {
            const artist = item.album.artist;
            if (!acc[artist]) {
                acc[artist] = [];
            }
            acc[artist].push(item);
            return acc;
        }, {} as Record<string, CollectionItem[]>);

        Object.values(grouped).forEach((items) => {
            items.sort((a, b) => a.album.title.localeCompare(b.album.title));
        });

        return grouped;
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
