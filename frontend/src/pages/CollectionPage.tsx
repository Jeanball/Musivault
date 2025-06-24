import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import axios from 'axios';

// Interfaces pour typer les données reçues
interface Album {
    _id: string;
    title: string;
    artist: string;
    cover_image: string;
    year: string;
}

interface CollectionItem {
    _id: string;
    album: Album;
    format: string;
    addedAt: string;
}

const CollectionPage: React.FC = () => {
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchCollection = async () => {
            try {
                const { data } = await axios.get<CollectionItem[]>('/api/collection', {
                    withCredentials: true,
                });
                setCollection(data);
            } catch (error) {
                console.error("Impossible de charger la collection", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCollection();
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8" data-theme="dark">
            <div className="navbar bg-base-100 rounded-box shadow-xl mb-8">
                <div className="flex-1">
                    <h1 className="text-xl font-bold">Ma Collection</h1>
                </div>
                <div className="flex-none">
                    <Link to="/" className="btn btn-outline btn-primary">
                        Retour à la recherche
                    </Link>
                </div>
            </div>

            {collection.length === 0 ? (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold">Votre collection est vide.</h2>
                    <p className="mt-2 text-gray-400">Commencez par rechercher des albums pour les ajouter.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {collection.map((item) => (
                        <div key={item._id} className="card bg-base-200 shadow-xl image-full">
                            <figure>
                                <img src={item.album.cover_image} alt={item.album.title} />
                            </figure>
                            <div className="card-body p-4 justify-end">
                                <h2 className="card-title text-base leading-tight">{item.album.title}</h2>
                                <p className="text-sm text-gray-300">{item.album.artist}</p>
                                <div className="badge badge-secondary mt-2">{item.format}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CollectionPage;
