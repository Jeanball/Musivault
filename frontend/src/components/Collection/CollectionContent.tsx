import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import CollectionFilters from '../Collection/CollectionFilters';
import CollectionStats from '../Collection/CollectionStats';
import CollectionTableView from '../Collection/Views/CollectionTableView';
import CollectionGridView from '../Collection/Views/CollectionGridView';
import CollectionListView from '../Collection/Views/CollectionListView';
import TracksView from '../Collection/Views/TracksView';
import PublicAlbumModal from '../Modal/PublicAlbumModal';
import { useCollectionFilters } from '../../hooks/collection/useCollectionFilters';
import { useCollectionSort } from '../../hooks/collection/useCollectionSort';
import { useCollectionStats } from '../../hooks/collection/useCollectionStats';
import type { CollectionItem, LayoutType } from '../../types/collection.types';

const SEARCH_STORAGE_KEY = 'musivault_collection_search';
const LAYOUT_STORAGE_KEY = 'musivault_collection_layout';
const VIEW_MODE_STORAGE_KEY = 'musivault_collection_view_mode';

type ViewMode = 'albums' | 'tracks';

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
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (readOnly) return 'albums';
        const stored = sessionStorage.getItem(VIEW_MODE_STORAGE_KEY);
        return (stored === 'albums' || stored === 'tracks') ? stored : 'albums';
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

    // Custom hooks
    const { filters, setFilters, filteredCollection, groupedByArtist, clearFilters } = useCollectionFilters(collection, searchTerm);
    const { handleSort, getSortIcon, sortedCollection, resetSort } = useCollectionSort(filteredCollection);
    const stats = useCollectionStats(collection);

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
            navigate(`/app/album/${item._id}`);
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
        filters.style !== 'all';

    return (
        <>
            <CollectionStats stats={stats} />

            {/* View Mode Tabs - Albums/Tracks toggle */}
            {!readOnly && (
                <div className="flex justify-center mb-4">
                    <div className="tabs tabs-boxed bg-base-200">
                        <button
                            className={`tab ${viewMode === 'albums' ? 'tab-active' : ''}`}
                            onClick={() => setViewMode('albums')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            {t('common.albums')}
                        </button>
                        <button
                            className={`tab ${viewMode === 'tracks' ? 'tab-active' : ''}`}
                            onClick={() => setViewMode('tracks')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            {t('common.tracks')}
                        </button>
                    </div>
                </div>
            )}

            {/* Tracks View */}
            {viewMode === 'tracks' && !readOnly ? (
                <TracksView collection={collection} />
            ) : (
                <>
                    {/* Advanced Filters */}
                    <CollectionFilters
                        filters={filters}
                        onFiltersChange={setFilters}
                        availableFormats={stats.availableFormats}
                        availableDecades={stats.availableDecades}
                        availableStyles={stats.availableStyles}
                        styleCounts={stats.styleCounts}
                        totalResults={collection.length}
                        filteredResults={filteredCollection.length}
                        onClearAll={hasAnyFilters ? handleClearAll : undefined}
                        layout={layout}
                        onLayoutChange={setLayout}
                    />

                    <div className="form-control mb-4">
                        <input
                            type="text"
                            placeholder={t('collection.searchAlbum')}
                            className="input input-bordered w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Main content */}
                    {(layout === 'table' ? sortedCollection.length === 0 : Object.keys(groupedByArtist).length === 0) ? (
                        <div className="text-center py-20">
                            <h2 className="text-2xl font-semibold">{t('collection.noResults')}</h2>
                            <p className="mt-2 text-gray-400">{t('collection.tryAgain')}</p>
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
                                    groupedItems={groupedByArtist}
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
