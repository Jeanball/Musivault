import React, { useState } from 'react';
import { useNavigate } from 'react-router';
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
<<<<<<< HEAD
=======
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    // Default to grid on mobile, list on desktop
    const [layout, setLayout] = useState<'grid' | 'list'>(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 1024 ? 'grid' : 'list';
        }
        return 'list';
    });
>>>>>>> 1b1bf1c (Upgrade mobile view)
    const navigate = useNavigate();
    const [layout, setLayout] = useState<LayoutType>('table');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);

    // Hooks personnalisés
    const { collection, isLoading, isDeleting, handleDeleteItem } = useCollectionData();
    const { filters, setFilters, filteredCollection, groupedByArtist } = useCollectionFilters(collection, searchTerm);
    const { sortBy, sortOrder, handleSort, getSortIcon, sortedCollection } = useCollectionSort(filteredCollection);
    const stats = useCollectionStats(collection);


    const handleItemClick = (item: CollectionItem) => {
        setSelectedItem(item);
    };

<<<<<<< HEAD
    const handleDeleteAndClose = async (itemId: string) => {
        await handleDeleteItem(itemId);
        setSelectedItem(null);
=======
    // Handle window resize for responsive layout switching
    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth < 1024;
            setLayout(isMobile ? 'grid' : 'list');
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const groupedByArtist = useMemo(() => {
        const filteredCollection = collection.filter(item => {
            const term = searchTerm.toLowerCase();
            return item.album.title.toLowerCase().includes(term) || 
                   item.album.artist.toLowerCase().includes(term);
        });

        return filteredCollection.reduce((acc, item) => {
            const artist = item.album.artist;
            if (!acc[artist]) {
                acc[artist] = [];
            }
            acc[artist].push(item);
            return acc;
        }, {} as Record<string, CollectionItem[]>);
    }, [collection, searchTerm]); 

        const handleDeleteItem = async (itemId: string) => {
        setIsDeleting(true);
        try {
            await axios.delete(`/api/collection/${itemId}`, { withCredentials: true });
            setCollection(currentCollection => currentCollection.filter(item => item._id !== itemId));
            toast.success("Album deleted of your collection!");
            setSelectedItem(null); 
        } catch (error) {
            console.log(error)
            toast.error("Suppression failed.");
        } finally {
            setIsDeleting(false);
        }
>>>>>>> 1b1bf1c (Upgrade mobile view)
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
<<<<<<< HEAD
        <div className="p-2 md:p-4">
            <CollectionHeader layout={layout} onLayoutChange={setLayout} />
            <CollectionStats stats={stats} />
=======
        <div>
            <div className="navbar bg-base-100 rounded-box shadow-xl mb-8">
                <div className="flex-1">
                    <div className="join">
                        <button className={`btn join-item btn-sm ${layout === 'grid' ? 'btn-active' : ''}`} onClick={() => setLayout('grid')}>Grille</button>
                        <button className={`btn join-item btn-sm ${layout === 'list' ? 'btn-active' : ''}`} onClick={() => setLayout('list')}>Liste</button>
                    </div>
                </div>
                <div className="flex-none gap-2">
                    <Link to="/" className="btn btn-outline btn-primary btn-sm">Add an album</Link>
                </div>
            </div>
>>>>>>> 1b1bf1c (Upgrade mobile view)

            <div className="form-control mb-4">
                <input 
                    type="text" 
                    placeholder="Search an album..." 
                    className="input input-bordered w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Filtres Avancés */}
            <CollectionFilters
                filters={filters}
                onFiltersChange={setFilters}
                availableFormats={stats.availableFormats}
                availableDecades={stats.availableDecades}
                totalResults={collection.length}
                filteredResults={filteredCollection.length}
            />
            

            {/* Contenu principal */}
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
