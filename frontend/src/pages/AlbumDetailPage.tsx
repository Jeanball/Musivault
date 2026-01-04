import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toastService } from '../utils/toast';
import { stripArtistSuffix } from '../utils/formatters';
import type { CollectionItem } from '../types/collection.types';
import RematchModal from '../components/Modal/RematchModal';

const AlbumDetailPage: React.FC = () => {
    const { itemId } = useParams<{ itemId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [item, setItem] = useState<CollectionItem | null>(null);
    const [spotifyUrl, setSpotifyUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isRematchOpen, setIsRematchOpen] = useState(false);

    useEffect(() => {
        if (itemId) {
            fetchCollectionItem(itemId);
        }
    }, [itemId]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [itemId]);

    useEffect(() => {
        if (item) {
            searchSpotify(item.album.artist, item.album.title);
            setLoading(false);
        }
    }, [item]);

    const fetchCollectionItem = async (id: string) => {
        try {
            const response = await axios.get(`/api/collection/${id}`, { withCredentials: true });
            setItem(response.data);
        } catch (error) {
            console.error('Failed to fetch collection item:', error);
            setLoading(false);
        }
    };

    const searchSpotify = (artist: string, album: string) => {
        const query = encodeURIComponent(`${artist} ${album}`);
        setSpotifyUrl(`https://open.spotify.com/search/${query}`);
    };

    const handleDelete = async () => {
        if (!confirm(t('album.confirmDelete'))) {
            return;
        }

        try {
            await axios.delete(`/api/collection/${item?._id}`, { withCredentials: true });
            toastService.success(t('album.removed'));
            navigate('/app');
        } catch (error) {
            console.error('Failed to delete album:', error);
            toastService.error(t('album.failedRemove'));
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
                    <span>{t('album.notFound')}</span>
                </div>
            </div>
        );
    }

    // Get data from MongoDB (item.album)
    const album = item.album;
    const tracklist = album.tracklist || [];
    const labels = album.labels || [];

    return (
        <div className="max-w-6xl mx-auto p-4">
            {/* Header Actions */}
            <div className="flex justify-start items-center mb-6">
                <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm gap-2">
                    <ArrowLeft size={16} /> {t('common.back')}
                </button>
            </div>

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row gap-8 mb-8">
                {/* Album Cover */}
                <div className="flex-shrink-0">
                    <img
                        src={album.cover_image || '/placeholder-album.svg'}
                        alt={album.title}
                        className="w-full lg:w-96 h-auto rounded-xl shadow-2xl"
                    />
                </div>

                {/* Album Information */}
                <div className="flex-1">
                    <h1 className="text-4xl md:text-5xl font-bold mb-3">{album.title}</h1>
                    <h2 className="text-2xl md:text-3xl text-base-content/70 mb-2">{stripArtistSuffix(album.artist)}</h2>
                    {labels.length > 0 && (
                        <p className="text-base text-base-content/60 mb-6">
                            <span>{t('album.label')}: </span>
                            <span className="text-base-content">{labels[0].name}</span>
                        </p>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-title">{t('common.year')}</div>
                            <div className="stat-value text-2xl">{album.year || '—'}</div>
                        </div>
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-title">{t('common.format')}</div>
                            <div className="stat-value text-2xl">
                                <select
                                    className="select select-bordered select-sm bg-base-200 text-base-content font-bold"
                                    value={item.format.name}
                                    onChange={async (e) => {
                                        const newFormat = e.target.value;
                                        try {
                                            await axios.put(`/api/collection/${item._id}`, {
                                                format: { name: newFormat }
                                            }, { withCredentials: true });

                                            setItem(prev => prev ? {
                                                ...prev,
                                                format: { ...prev.format, name: newFormat }
                                            } : null);
                                            toastService.success(t('album.formatUpdated', { format: newFormat }));
                                        } catch (error) {
                                            console.error('Failed to update format:', error);
                                            toastService.error(t('album.failedUpdateFormat'));
                                        }
                                    }}
                                >
                                    <option value="Vinyl">{t('formats.vinyl')}</option>
                                    <option value="CD">{t('formats.cd')}</option>

                                    <option value="Cassette">{t('formats.cassette')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-title">{t('collection.added')}</div>
                            <div className="stat-value text-lg">
                                {new Date(item.addedAt).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    {/* Genres & Format Details - Side by Side */}
                    <div className="flex flex-wrap gap-8 mb-6">
                        {(album.styles?.length ?? 0) > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-base-content/60 mb-2">{t('album.genres')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {album.styles!.map((style, index) => (
                                        <span key={index} className="badge badge-primary badge-lg">
                                            {style}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {(item.format.text || (item.format.descriptions && item.format.descriptions.length > 0)) && (
                            <div>
                                <h3 className="text-sm font-semibold text-base-content/60 mb-2">{t('album.formatDetails')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {item.format.text && (
                                        <span className="badge badge-accent badge-lg">{item.format.text}</span>
                                    )}
                                    {item.format.descriptions?.map((desc, index) => (
                                        <span key={index} className="badge badge-lg">{desc}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* External Links */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        {spotifyUrl && (
                            <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                </svg>
                                {t('album.listenOnSpotify')}
                            </a>
                        )}
                        {album.discogsId && (
                            <a href={`https://www.discogs.com/release/${album.discogsId}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                                {t('album.viewOnDiscogs')}
                            </a>
                        )}
                    </div>

                    {/* Management Actions */}
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => setIsRematchOpen(true)} className="btn btn-warning btn-outline" title="Fix incorrect Discogs match">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t('album.rematch')}
                        </button>
                        <button onClick={handleDelete} className="btn btn-error btn-outline" title="Remove from collection">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {t('common.delete')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Tracklist Section */}
            {tracklist.length > 0 && (
                <div className="card bg-base-200 shadow-xl mb-8">
                    <div className="card-body">
                        <h2 className="card-title text-2xl mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            {t('album.tracklist')} ({t('album.trackCount', { count: tracklist.length })})
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="table table-zebra">
                                <thead>
                                    <tr>
                                        <th className="w-20">#</th>
                                        <th>{t('common.title')}</th>
                                        <th className="w-32 text-right">{t('album.duration')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tracklist.map((track, index) => (
                                        <tr key={index} className="hover">
                                            <td className="font-mono text-base">{track.position}</td>
                                            <td>
                                                <div className="font-medium">{track.title}</div>
                                                {track.artist && (
                                                    <div className="text-sm text-base-content/60">{track.artist}</div>
                                                )}
                                            </td>
                                            <td className="text-right font-mono">{track.duration || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Rematch Modal */}
            {item && (
                <RematchModal
                    isOpen={isRematchOpen}
                    onClose={() => setIsRematchOpen(false)}
                    itemId={item._id}
                    currentArtist={item.album.artist}
                    currentTitle={item.album.title}
                    onRematchSuccess={() => {
                        if (itemId) fetchCollectionItem(itemId);
                    }}
                />
            )}
        </div>
    );
};

export default AlbumDetailPage;
