import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import type { FormatDetails } from '../components/Modal/AddAlbumVersionModal';
import ShowAlbumModal from '../components/Modal/ShowAlbumModal';
import { toast } from 'react-toastify';

interface Album {
    _id: string;
    title: string;
    artist: string;
    cover_image: string;
    thumb: string;
    year: string;
}


export interface CollectionItem {
    _id: string;
    album: Album;
    format: FormatDetails; 
    addedAt: string;
}

const CollectionPage: React.FC = () => {
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [layout, setLayout] = useState<'grid' | 'list'>('list');
    const navigate = useNavigate();

    const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);


    useEffect(() => {
        const fetchCollection = async () => {
            try {
                const { data } = await axios.get<CollectionItem[]>('/api/collection', {
                    withCredentials: true,
                });
                setCollection(data);
            } catch (error) {
                console.error("Error by charging collection: ", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCollection();
    }, [navigate]);

    const groupedByArtist = useMemo(() => {
        return collection.reduce((acc, item) => {
            if (item.album && item.album.artist) {
                const artist = item.album.artist;
                if (!acc[artist]) {
                    acc[artist] = [];
                }
                acc[artist].push(item);
            }
            return acc;
        }, {} as Record<string, CollectionItem[]>);
    }, [collection]);

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
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

return (
        <div className="p-4 md:p-8">
                <div className="flex-none gap-2">
                     <div className="join">
                        <button className={`btn join-item btn-sm ${layout === 'grid' ? 'btn-active' : ''}`} onClick={() => setLayout('grid')}>Grille</button>
                        <button className={`btn join-item btn-sm ${layout === 'list' ? 'btn-active' : ''}`} onClick={() => setLayout('list')}>Liste</button>
                    </div>
                </div>
<div className="mt-8">
            {collection.length === 0 ? (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold">Your collection is empty.</h2>
                    <p className="mt-2 text-gray-400">Start by searching new albums on Homepage.</p>
                </div>
            ) : (
                   <div className="space-y-10">
                        {Object.entries(groupedByArtist).map(([artist, items]) => (
                            <div key={artist}>
                                <h2 className="text-2xl font-bold mb-4 pb-2 border-b-2 border-primary/50">{artist}</h2>
                                {layout === 'grid' ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                        {items.map((item) => (
                                            <div key={item._id} onClick={() => setSelectedItem(item)} className="card bg-base-200 shadow-xl transition-transform hover:scale-105 cursor-pointer">
                                                <figure><img src={item.album.cover_image} alt={item.album.title} className="aspect-square object-cover" /></figure>
                                                <div className="card-body p-3">
                                                    <h2 className="card-title text-sm font-bold leading-tight truncate" title={item.album.title}>{item.album.title}</h2>
                                                    <div className="card-actions justify-start mt-2">
                                                        <div className="badge badge-secondary">{item.format.name}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="table w-full">
                                            <thead>
                                                <tr>
                                                    <th>Cover</th>
                                                    <th>Album</th>
                                                    <th>Format</th>
                                                    <th>Released</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item) => (
                                                    <tr key={item._id} onClick={() => setSelectedItem(item)} className="hover cursor-pointer">
                                                        <td>
                                                            <div className="avatar">
                                                                <div className="w-12 h-12 rounded-lg"><img src={item.album.cover_image} alt={item.album.title} /></div>
                                                            </div>
                                                        </td>
                                                        <td><div className="font-bold">{item.album.title}</div></td>
                                                        <td>
                                                            <div className="font-semibold">{item.format.name}</div>
                                                            <div className="text-xs opacity-70">{item.format.text}</div>
                                                        </td>
                                                        <td>{item.album.year}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
            
            )}
            </div>
                <ShowAlbumModal
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onDelete={handleDeleteItem}
                isDeleting={isDeleting}
                />
        </div>
    );
};

export default CollectionPage;
