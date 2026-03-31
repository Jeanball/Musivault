import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import CollectionFilters from '../Collection/CollectionFilters';
import CollectionTableView from '../Collection/Views/CollectionTableView';
import CollectionGridView from '../Collection/Views/CollectionGridView';
import CollectionListView from '../Collection/Views/CollectionListView';
import TracksView from '../Collection/Views/TracksView';
import PublicAlbumModal from '../Modal/PublicAlbumModal';
import { useCollectionFilters } from '../../hooks/collection/useCollectionFilters';
import { useCollectionSort } from '../../hooks/collection/useCollectionSort';
import { useCollectionStats } from '../../hooks/collection/useCollectionStats';
import type { CollectionItem, LayoutType } from '../../types/collection.types';
import { BarChart2 } from 'lucide-react';
import { hasActiveFormatVerificationIssue } from '../../utils/formatVerification';

const SEARCH_STORAGE_KEY = 'musivault_collection_search';
const LAYOUT_STORAGE_KEY = 'musivault_collection_layout';
const VIEW_MODE_STORAGE_KEY = 'musivault_collection_view_mode';
const COLLECTION_SCROLL_KEY = 'musivault_collection_scroll_y';

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
    const deferredSearchTerm = useDeferredValue(searchTerm);
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
    const { filters, setFilters, filteredCollection, groupedByArtist, clearFilters } = useCollectionFilters(collection, deferredSearchTerm);
    const { handleSort, getSortIcon, sortedCollection, resetSort } = useCollectionSort(filteredCollection);
    const stats = useCollectionStats(collection);
    const issueCount = useMemo(
        () => collection.reduce((count, item) => count + (hasActiveFormatVerificationIssue(item.formatVerification) ? 1 : 0), 0),
        [collection]
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
        filters.issueStatus !== 'all';

    return (
        <>
            {/* Mobile Stats Button */}
            {!readOnly && (
                <div className="md:hidden flex justify-end mb-4 pr-1">
                    <button 
                        onClick={() => navigate('/app/stats')}
                        className="btn btn-sm btn-outline btn-primary gap-2"
                    >
                        <BarChart2 size={16} />
                        {t('nav.stats', 'Stats')}
                    </button>
                </div>
            )}

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
                issueCount={issueCount}
                viewMode={readOnly ? undefined : viewMode}
                onViewModeChange={readOnly ? undefined : setViewMode}
                layout={layout}
                onLayoutChange={setLayout}
            />

            {/* Tracks View */}
            {viewMode === 'tracks' && !readOnly ? (
                <TracksView collection={filteredCollection} />
            ) : (
                <>
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
