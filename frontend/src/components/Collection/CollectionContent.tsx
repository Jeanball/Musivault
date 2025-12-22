import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import CollectionFilters from '../Collection/CollectionFilters';
import CollectionStats from '../Collection/CollectionStats';
import CollectionTableView from '../Collection/Views/CollectionTableView';
import CollectionGridView from '../Collection/Views/CollectionGridView';
import CollectionListView from '../Collection/Views/CollectionListView';
import PublicAlbumModal from '../Modal/PublicAlbumModal';
import { useCollectionFilters } from '../../hooks/collection/useCollectionFilters';
import { useCollectionSort } from '../../hooks/collection/useCollectionSort';
import { useCollectionStats } from '../../hooks/collection/useCollectionStats';
import type { CollectionItem, LayoutType } from '../../types/collection';

const SEARCH_STORAGE_KEY = 'musivault_collection_search';
const LAYOUT_STORAGE_KEY = 'musivault_collection_layout';

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
                    placeholder="Search an album..."
                    className="input input-bordered w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Main content */}
            {(layout === 'table' ? sortedCollection.length === 0 : Object.keys(groupedByArtist).length === 0) ? (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold">No result found.</h2>
                    <p className="mt-2 text-gray-400">Please try again</p>
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
