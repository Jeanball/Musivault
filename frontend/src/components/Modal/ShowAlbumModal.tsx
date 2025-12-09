import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CollectionItem } from '../../types/collection';
import axios from 'axios';

interface ShowAlbumModalProps {
    item: CollectionItem | null;
    onClose: () => void;
    onDelete: (itemId: string) => void;
    isDeleting: boolean;
}

interface Track {
    position: string;
    title: string;
    duration: string;
}

interface AlbumDetails {
    title: string;
    artists: Array<{ name: string }>;
    year: number;
    genres?: string[];
    styles?: string[];
    tracklist?: Track[];
    cover_image?: string;
    labels?: Array<{ name: string }>;
    formats?: Array<{ name: string; descriptions?: string[] }>;
}

const ShowAlbumModal: React.FC<ShowAlbumModalProps> = ({ item, onClose, onDelete, isDeleting }) => {
    const navigate = useNavigate();
    const [albumDetails, setAlbumDetails] = useState<AlbumDetails | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (item?.album?.discogsId) {
            fetchAlbumDetails(item.album.discogsId);
        }
    }, [item?.album?.discogsId]);

    const fetchAlbumDetails = async (discogsId: number) => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/discogs/release/${discogsId}`);
            setAlbumDetails(response.data);
        } catch (error) {
            console.error('Failed to fetch album details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!item) return null;

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to remove this album from your collection?')) {
            onDelete(item._id);
        }
    };

    return (
        <dialog id="collection_item_modal" className="modal modal-middle px-4" open={!!item}>
            <div className="modal-box max-w-4xl w-full max-h-[80vh] overflow-y-auto pb-6">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                >
                    ✕
                </button>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                ) : (
                    <>
                        {/* Header with cover and basic info */}
                        <div className="flex flex-col md:flex-row gap-6 mb-6">
                            {/* Album Cover */}
                            <div className="flex-shrink-0">
                                <img
                                    src={albumDetails?.cover_image || item.album.cover_image || '/placeholder-album.png'}
                                    alt={item.album.title}
                                    className="w-full md:w-64 h-auto rounded-lg shadow-xl"
                                />
                            </div>

                            {/* Album Info */}
                            <div className="flex-1">
                                <h2 className="text-3xl font-bold mb-2">{item.album.title}</h2>
                                <p className="text-xl text-base-content/70 mb-4">{item.album.artist}</p>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <span className="text-sm text-base-content/60">Year</span>
                                        <p className="font-semibold">{albumDetails?.year || item.album.year}</p>
                                    </div>
                                    <div>
                                        <span className="text-sm text-base-content/60">Format</span>
                                        <p className="font-semibold capitalize">{item.format.name}</p>
                                    </div>
                                    <div>
                                        <span className="text-sm text-base-content/60">Added</span>
                                        <p className="font-semibold">
                                            {new Date(item.addedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    {albumDetails?.labels && albumDetails.labels.length > 0 && (
                                        <div>
                                            <span className="text-sm text-base-content/60">Label</span>
                                            <p className="font-semibold">{albumDetails.labels[0].name}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Genres and Styles */}
                                {(albumDetails?.genres || albumDetails?.styles) && (
                                    <div className="mb-4">
                                        {albumDetails.genres && albumDetails.genres.length > 0 && (
                                            <div className="mb-2">
                                                <span className="text-sm text-base-content/60">Genres: </span>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {albumDetails.genres.map((genre, index) => (
                                                        <span key={index} className="badge badge-primary">
                                                            {genre}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {albumDetails.styles && albumDetails.styles.length > 0 && (
                                            <div>
                                                <span className="text-sm text-base-content/60">Styles: </span>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {albumDetails.styles.map((style, index) => (
                                                        <span key={index} className="badge badge-secondary badge-outline">
                                                            {style}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tracklist */}
                        {albumDetails?.tracklist && albumDetails.tracklist.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                    Tracklist
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="table table-zebra">
                                        <thead>
                                            <tr>
                                                <th className="w-16">#</th>
                                                <th>Title</th>
                                                <th className="w-24 text-right">Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {albumDetails.tracklist.map((track, index) => (
                                                <tr key={index}>
                                                    <td className="font-mono text-sm">{track.position}</td>
                                                    <td>{track.title}</td>
                                                    <td className="text-right font-mono text-sm">{track.duration || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-2 mt-6">
                            <button
                                onClick={() => {
                                    navigate(`/app/album/${item._id}`);
                                    onClose();
                                }}
                                className="btn btn-primary w-full"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                More Details
                            </button>
                            <button
                                onClick={handleDelete}
                                className={`btn btn-error w-full ${isDeleting ? 'loading' : ''}`}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Remove'}
                            </button>
                            <button onClick={onClose} className="btn btn-ghost w-full">
                                Close
                            </button>
                        </div>
                    </>
                )}
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    );
};

export default ShowAlbumModal;