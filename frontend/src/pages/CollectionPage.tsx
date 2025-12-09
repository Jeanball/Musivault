import React, { useState } from 'react';
import ShowAlbumModal from '../components/Modal/ShowAlbumModal';
import CollectionFilters from '../components/Collection/CollectionFilters';
import CollectionStats from '../components/Collection/CollectionStats';
import CollectionHeader from '../components/Collection/Layout/CollectionHeader';
import CollectionTableView from '../components/Collection/Views/CollectionTableView';
import CollectionGridView from '../components/Collection/Views/CollectionGridView';
import CollectionListView from '../components/Collection/Views/CollectionListView';
import { useCollectionData } from '../hooks/collection/useCollectionData';
import { useCollectionFilters } from '../hooks/collection/useCollectionFilters';
import { useCollectionSort } from '../hooks/collection/useCollectionSort';
import { useCollectionStats } from '../hooks/collection/useCollectionStats';
import type { CollectionItem, LayoutType } from '../types/collection';



const CollectionPage: React.FC = () => {
    // Detect mobile device and set default layout accordingly
    const isMobile = window.innerWidth < 768; // md breakpoint in Tailwind
    const [layout, setLayout] = useState<LayoutType>(isMobile ? 'grid' : 'table');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);

    // Custom hooks
    const { collection, isLoading, isDeleting, handleDeleteItem } = useCollectionData();
    const { filters, setFilters, filteredCollection, groupedByArtist } = useCollectionFilters(collection, searchTerm);
    const { handleSort, getSortIcon, sortedCollection } = useCollectionSort(filteredCollection);
    const stats = useCollectionStats(collection);


    const handleItemClick = (item: CollectionItem) => {
        setSelectedItem(item);
    };

    const handleDeleteAndClose = async (itemId: string) => {
        await handleDeleteItem(itemId);
        setSelectedItem(null);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div className="p-2 md:p-4">
            <CollectionHeader layout={layout} onLayoutChange={setLayout} />
            <CollectionStats stats={stats} />

            <div className="form-control mb-4">
                <input
                    type="text"
                    placeholder="Search an album..."
                    className="input input-bordered w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Advanced Filters */}
            <CollectionFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableFormats={stats.availableFormats}
                availableDecades={stats.availableDecades}
                totalResults={collection.length}
                filteredResults={filteredCollection.length}
            />


            {/* Main content */}
            {(layout === 'table' ? sortedCollection.length === 0 : Object.keys(groupedByArtist).length === 0) && !isLoading ? (
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

            <ShowAlbumModal
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onDelete={handleDeleteAndClose}
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default CollectionPage;
