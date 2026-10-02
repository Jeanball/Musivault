import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import CollectionFilters from './CollectionFilters';
import CollectionTableView from './Views/CollectionTableView';
import CollectionGridView from './Views/CollectionGridView';
import CollectionListView from './Views/CollectionListView';
import CollectionTracksView from './Views/CollectionTracksView';
import CollectionLabelsView from './Views/CollectionLabelsView';
import PublicAlbumModal from '../Modal/PublicAlbumModal';
import { useCollectionFilters } from '../../hooks/collection/useCollectionFilters';
import { useCollectionSort } from '../../hooks/collection/useCollectionSort';
import { useCollectionStats } from '../../hooks/collection/useCollectionStats';
import type { CollectionItem, LayoutType, CollectionViewMode } from '../../types/collection.types';
import { hasActiveFormatVerificationIssue } from '../../utils/formatVerification';

const SEARCH_STORAGE_KEY = 'musivault_collection_search';
const LAYOUT_STORAGE_KEY = 'musivault_collection_layout';
const VIEW_MODE_STORAGE_KEY = 'musivault_collection_view_mode';
const COLLECTION_SCROLL_KEY = 'musivault_collection_scroll_y';

const VIEW_MODES: CollectionViewMode[] = ['albums', 'tracks', 'labels'];

/** One field for the three modes, so only its wording moves. */
const SEARCH_PLACEHOLDER_KEYS: Record<CollectionViewMode, string> = {
    albums: 'collection.searchAlbum',
    tracks: 'tracks.searchTrack',
    labels: 'labels.searchLabel',
};

interface CollectionContentProps {
    collection: CollectionItem[];
    isLoading: boolean;
    readOnly?: boolean;
    onDelete?: (itemId: string) => Promise<void>;
    isDeleting?: boolean;
}

const CollectionContent: React.FC<CollectionContentProps> = ({
    collection,
    isLoading,
    readOnly = false,
}) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Detect mobile device and set default layout accordingly
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const getInitialLayout = (): LayoutType => {
        if (readOnly) return isMobile ? 'grid' : 'table';
        const stored = sessionStorage.getItem(LAYOUT_STORAGE_KEY);
        if (stored && ['grid', 'list', 'table'].includes(stored)) {
            return stored as LayoutType;
        }
        return isMobile ? 'grid' : 'table';
    };

    const [layout, setLayout] = useState<LayoutType>(getInitialLayout);
    const [searchTerm, setSearchTerm] = useState(() =>
        readOnly ? '' : (sessionStorage.getItem(SEARCH_STORAGE_KEY) || '')
    );
    const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const [viewMode, setViewMode] = useState<CollectionViewMode>(() => {
        if (readOnly) return 'albums';
        const stored = sessionStorage.getItem(VIEW_MODE_STORAGE_KEY);
        return VIEW_MODES.includes(stored as CollectionViewMode) ? (stored as CollectionViewMode) : 'albums';
    });

    // Persist layout preference (only for authenticated users)
    useEffect(() => {
        if (!readOnly) {
            sessionStorage.setItem(LAYOUT_STORAGE_KEY, layout);
        }
    }, [layout, readOnly]);

    // Persist search term (only for authenticated users)
    useEffect(() => {
        if (!readOnly) {
            sessionStorage.setItem(SEARCH_STORAGE_KEY, searchTerm);
        }
    }, [searchTerm, readOnly]);

    // Persist view mode (only for authenticated users)
    useEffect(() => {
        if (!readOnly) {
            sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
        }
    }, [viewMode, readOnly]);

    // Tracks and labels search their own aggregates, so the term stays out of the
    // album filter there rather than narrowing twice from a single field.
    const isAggregateMode = viewMode === 'tracks' || viewMode === 'labels';

    // Custom hooks
    const { filters, setFilters, filteredCollection, groupedByArtist, clearFilters } = useCollectionFilters(
        collection,
        isAggregateMode ? '' : deferredSearchTerm
    );
    const { handleSort, getSortIcon, sortedCollection, resetSort } = useCollectionSort(filteredCollection);
    const stats = useCollectionStats(collection);
    // Format mismatches are a private housekeeping signal, so a visitor never gets
    // the toggle even though the shared items carry the flag.
    const issueCount = useMemo(
        () => readOnly
            ? 0
            : collection.reduce((count, item) => count + (hasActiveFormatVerificationIssue(item.formatVerification) ? 1 : 0), 0),
        [collection, readOnly]
    );

    // The grid runs as one uninterrupted flow, so the artist grouping survives only
    // as the order: every album of an artist still lands side by side.
    const gridItems = useMemo(
        () => Object.entries(groupedByArtist)
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(([, artistItems]) => artistItems),
        [groupedByArtist]
    );

    const handleClearAll = () => {
        setSearchTerm('');
        clearFilters();
        resetSort();
    };

    const handleItemClick = (item: CollectionItem) => {
        if (readOnly) {
            // Public collection: show modal
            setSelectedItem(item);
        } else {
            // Private collection: navigate to detail page
            sessionStorage.setItem(COLLECTION_SCROLL_KEY, String(window.scrollY));
            navigate(`/app/album/${item._id}`, {
                state: { backTo: '/app/collection' }
            });
        }
    };

    /** The tracks and labels views only carry the item id back. */
    const handleItemIdClick = (itemId: string) => {
        const item = collection.find((entry) => entry._id === itemId);
        if (item) {
            handleItemClick(item);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    const hasAnyFilters = searchTerm !== '' ||
        filters.format !== 'all' ||
        filters.decade !== 'all' ||
        filters.addedPeriod !== 'all' ||
        filters.style !== 'all' ||
        filters.label !== 'all' ||
        filters.issueStatus !== 'all';

    return (
        <>
            <CollectionFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableFormats={stats.availableFormats}
                availableDecades={stats.availableDecades}
                availableStyles={stats.availableStyles}
                styleCounts={stats.styleCounts}
                availableLabels={stats.availableLabels}
                labelCounts={stats.labelCounts}
                totalResults={collection.length}
                filteredResults={filteredCollection.length}
                onClearAll={hasAnyFilters ? handleClearAll : undefined}
                issueCount={issueCount}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder={t(SEARCH_PLACEHOLDER_KEYS[viewMode])}
                layout={isAggregateMode ? undefined : layout}
                onLayoutChange={isAggregateMode ? undefined : setLayout}
            />

            {viewMode === 'tracks' ? (
                <CollectionTracksView
                    collection={filteredCollection}
                    searchTerm={deferredSearchTerm}
                    onAlbumClick={handleItemIdClick}
                />
            ) : viewMode === 'labels' ? (
                <CollectionLabelsView
                    collection={filteredCollection}
                    searchTerm={deferredSearchTerm}
                    onItemClick={handleItemIdClick}
                />
            ) : (
                <>
                    {/* Main content */}
                    {(layout === 'table' ? sortedCollection.length === 0 : Object.keys(groupedByArtist).length === 0) ? (
                        <div className="text-center py-20">
                            <h2 className="text-2xl font-semibold">{t('collection.noResults')}</h2>
                            <p className="mt-2 text-base-content/70">{t('collection.tryAgain')}</p>
                        </div>
                    ) : (
                        <>
                            {layout === 'table' && (
                                <CollectionTableView
                                    items={sortedCollection}
                                    onItemClick={handleItemClick}
                                    onSort={handleSort}
                                    getSortIcon={getSortIcon}
                                />
                            )}
                            {layout === 'grid' && (
                                <CollectionGridView
                                    items={gridItems}
                                    onItemClick={handleItemClick}
                                />
                            )}
                            {layout === 'list' && (
                                <CollectionListView
                                    groupedItems={groupedByArtist}
                                    onItemClick={handleItemClick}
                                />
                            )}
                        </>
                    )}
                </>
            )}

            {/* Public Album Modal (only for readOnly mode) */}
            {readOnly && (
                <PublicAlbumModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </>
    );
};

export default CollectionContent;
