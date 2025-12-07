import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import axios from 'axios';
import type { CollectionItem } from '../types/collection';

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
    uri?: string;
}

const AlbumDetailPage: React.FC = () => {
    const { itemId } = useParams<{ itemId: string }>();
    const navigate = useNavigate();
    const [item, setItem] = useState<CollectionItem | null>(null);
    const [albumDetails, setAlbumDetails] = useState<AlbumDetails | null>(null);
    const [spotifyUrl, setSpotifyUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (itemId) {
            fetchCollectionItem(itemId);
        }
    }, [itemId]);

    useEffect(() => {
        if (item?.album?.discogsId) {
            fetchAlbumDetails(item.album.discogsId);
        }
        if (item) {
            searchSpotify(item.album.artist, item.album.title);
        }
    }, [item]);

    const fetchCollectionItem = async (id: string) => {
        try {
            const response = await axios.get(`/api/collection/${id}`, { withCredentials: true });
            setItem(response.data);
        } catch (error) {
            console.error('Failed to fetch collection item:', error);
        }
    };

    const fetchAlbumDetails = async (discogsId: number) => {
        try {
            const response = await axios.get(`/api/discogs/release/${discogsId}`);
            setAlbumDetails(response.data);
        } catch (error) {
            console.error('Failed to fetch album details:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchSpotify = async (artist: string, album: string) => {
        try {
            // Simplified Spotify search - construct URL directly
            const query = encodeURIComponent(`${artist} ${album}`);
            const spotifySearchUrl = `https://open.spotify.com/search/${query}`;
            setSpotifyUrl(spotifySearchUrl);
        } catch (error) {
            console.error('Failed to create Spotify link:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="p-8">
                <div className="alert alert-error">
                    <span>Album not found</span>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4">
            {/* Back button */}
            <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm mb-6">
                ← Back
            </button>

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row gap-8 mb-8">
                {/* Album Cover */}
                <div className="flex-shrink-0">
                    <img
                        src={albumDetails?.cover_image || item.album.cover_image || '/placeholder-album.png'}
                        alt={item.album.title}
                        className="w-full lg:w-96 h-auto rounded-xl shadow-2xl"
                    />
                </div>

                {/* Album Information */}
                <div className="flex-1">
                    <h1 className="text-4xl md:text-5xl font-bold mb-3">{item.album.title}</h1>
                    <h2 className="text-2xl md:text-3xl text-base-content/70 mb-6">{item.album.artist}</h2>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-title">Year</div>
                            <div className="stat-value text-2xl">{albumDetails?.year || item.album.year}</div>
                        </div>
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-title">Format</div>
                            <div className="stat-value text-2xl capitalize">{item.format.name}</div>
                        </div>
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-title">Added</div>
                            <div className="stat-value text-lg">
                                {new Date(item.addedAt).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    {/* Label */}
                    {albumDetails?.labels && albumDetails.labels.length > 0 && (
                        <div className="mb-4">
                            <span className="text-sm text-base-content/60">Record Label: </span>
                            <span className="font-semibold text-lg">{albumDetails.labels[0].name}</span>
                        </div>
                    )}

                    {/* Genres */}
                    {albumDetails?.genres && albumDetails.genres.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-base-content/60 mb-2">GENRES</h3>
                            <div className="flex flex-wrap gap-2">
                                {albumDetails.genres.map((genre, index) => (
                                    <span key={index} className="badge badge-primary badge-lg">
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Styles */}
                    {albumDetails?.styles && albumDetails.styles.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-base-content/60 mb-2">STYLES</h3>
                            <div className="flex flex-wrap gap-2">
                                {albumDetails.styles.map((style, index) => (
                                    <span key={index} className="badge badge-secondary badge-outline badge-lg">
                                        {style}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* External Links */}
                    <div className="flex gap-3">
                        {spotifyUrl && (
                            <a
                                href={spotifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-success"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                </svg>
                                Listen on Spotify
                            </a>
                        )}
                        {item.album.discogsId && (
                            <a
                                href={`https://www.discogs.com/release/${item.album.discogsId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline"
                            >
                                View on Discogs
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Tracklist Section */}
            {albumDetails?.tracklist && albumDetails.tracklist.length > 0 && (
                <div className="card bg-base-200 shadow-xl mb-8">
                    <div className="card-body">
                        <h2 className="card-title text-2xl mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            Tracklist ({albumDetails.tracklist.length} tracks)
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="table table-zebra">
                                <thead>
                                    <tr>
                                        <th className="w-20">#</th>
                                        <th>Title</th>
                                        <th className="w-32 text-right">Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {albumDetails.tracklist.map((track, index) => (
                                        <tr key={index} className="hover">
                                            <td className="font-mono text-base">{track.position}</td>
                                            <td className="font-medium">{track.title}</td>
                                            <td className="text-right font-mono">{track.duration || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Format Details */}
            {item.format.descriptions && item.format.descriptions.length > 0 && (
                <div className="card bg-base-200 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title text-xl">Format Details</h2>
                        <div className="flex flex-wrap gap-2">
                            {item.format.descriptions.map((desc, index) => (
                                <span key={index} className="badge badge-lg">{desc}</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlbumDetailPage;
