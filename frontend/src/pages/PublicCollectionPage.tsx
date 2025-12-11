import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import axios from 'axios';
import CollectionHeader from '../components/Collection/Layout/CollectionHeader';
import CollectionStats from '../components/Collection/CollectionStats';
import CollectionFilters from '../components/Collection/CollectionFilters';
import CollectionGridView from '../components/Collection/Views/CollectionGridView';
import CollectionListView from '../components/Collection/Views/CollectionListView';
import CollectionTableView from '../components/Collection/Views/CollectionTableView';
import ShowAlbumModal from '../components/Modal/ShowAlbumModal';
import Footer from '../components/Footer';
import { useCollectionFilters } from '../hooks/collection/useCollectionFilters';
import { useCollectionSort } from '../hooks/collection/useCollectionSort';
import { useCollectionStats } from '../hooks/collection/useCollectionStats';
import type { CollectionItem, LayoutType } from '../types/collection';

interface PublicCollectionResponse {
    username: string;
    collection: CollectionItem[];
    total: number;
}

const PublicCollectionPage: React.FC = () => {
    const { shareId } = useParams<{ shareId: string }>();
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [username, setUsername] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);

    // Layout state
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const [layout, setLayout] = useState<LayoutType>(isMobile ? 'grid' : 'table');
    const [searchTerm, setSearchTerm] = useState('');

    // Custom hooks - same as CollectionPage
    const { filters, setFilters, filteredCollection, groupedByArtist } = useCollectionFilters(collection, searchTerm);
    const { handleSort, getSortIcon, sortedCollection } = useCollectionSort(filteredCollection);
    const stats = useCollectionStats(collection);

    useEffect(() => {
        const fetchPublicCollection = async () => {
            if (!shareId) return;

            try {
                const response = await axios.get<PublicCollectionResponse>(`/api/public/${shareId}`);
                setCollection(response.data.collection);
                setUsername(response.data.username);
            } catch (err: any) {
                if (err.response?.status === 404) {
                    setError('Collection not found or is private');
                } else {
                    setError('Failed to load collection');
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchPublicCollection();
    }, [shareId]);

    const handleItemClick = (item: CollectionItem) => {
        setSelectedItem(item);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-100" data-theme="dark">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-base-100 p-8" data-theme="dark">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">🔒</h1>
                    <h2 className="text-2xl font-bold mb-2">{error}</h2>
                    <p className="text-base-content/70 mb-6">
                        This collection may be private or the link may be invalid.
                    </p>
                    <Link to="/" className="btn btn-primary">
                        Go to Homepage
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-100 p-2 md:p-4" data-theme="dark">
            {/* Public Collection Header */}
            <div className="mb-6 text-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                    {username}'s Collection
                </h1>
                <p className="text-base-content/60">
                    Powered by <Link to="/" className="link link-primary">Musivault</Link>
                </p>
            </div>

            <CollectionHeader layout={layout} onLayoutChange={setLayout} readOnly={true} />
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

            <CollectionFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableFormats={stats.availableFormats}
                availableDecades={stats.availableDecades}
                totalResults={collection.length}
                filteredResults={filteredCollection.length}
            />

            {/* Main content - same views as CollectionPage */}
            {(layout === 'table' ? sortedCollection.length === 0 : Object.keys(groupedByArtist).length === 0) ? (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold">No results found.</h2>
                    <p className="mt-2 text-gray-400">Try a different search term</p>
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

            {/* Modal - read only mode */}
            <ShowAlbumModal
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                readOnly={true}
            />

            {/* Footer */}
            <div className="mt-12">
                <Footer />
            </div>
        </div>
    );
};

export default PublicCollectionPage;
