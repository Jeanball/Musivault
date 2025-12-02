import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import type { ArtistReleasesData, ArtistAlbum } from '../types';

type FormatFilter = 'all' | 'master' | 'release';

const ArtistAlbumsPage: React.FC = () => {
    const { artistId } = useParams<{ artistId: string }>();
    const navigate = useNavigate();
    const [artistData, setArtistData] = useState<ArtistReleasesData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [filter, setFilter] = useState<FormatFilter>('all');

    useEffect(() => {
        const fetchArtistReleases = async () => {
            if (!artistId) return;
            try {
                const { data } = await axios.get<ArtistReleasesData>(`/api/discogs/artist/${artistId}/releases`, {
                    withCredentials: true
                });
                setArtistData(data);
            } catch (error) {
                console.log("Error loading artist releases: ", error);
                toast.error("Error loading artist releases.");
                navigate('/');
            } finally {
                setIsLoading(false);
            }
        };
        fetchArtistReleases();
    }, [artistId, navigate]);

    const filteredReleases = useMemo(() => {
        if (!artistData) return [];
        if (filter === 'all') return artistData.releases;
        return artistData.releases.filter(release => release.type === filter);
    }, [artistData, filter]);

    // Grouper les releases par master_id pour éviter les doublons
    const groupedReleases = useMemo(() => {
        const grouped = new Map<string, ArtistAlbum>();
        
        filteredReleases.forEach(release => {
            // Si c'est un master ou une release avec master_id, on groupe
            const key = release.type === 'master' 
                ? `master-${release.id}` 
                : release.master_id 
                    ? `master-${release.master_id}`
                    : `release-${release.id}`;
            
            // On garde le master si disponible, sinon la première release
            if (!grouped.has(key) || release.type === 'master') {
                grouped.set(key, release);
            }
        });
        
        return Array.from(grouped.values()).sort((a, b) => {
            const yearA = parseInt(a.year) || 0;
            const yearB = parseInt(b.year) || 0;
            return yearB - yearA; // Plus récent en premier
        });
    }, [filteredReleases]);

    const handleAlbumClick = (album: ArtistAlbum) => {
        if (album.type === 'master') {
            navigate(`/app/master/${album.id}`);
        } else if (album.master_id) {
            navigate(`/app/master/${album.master_id}`);
        } else {
            navigate(`/app/release/${album.id}`);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen"><span className="loading loading-spinner loading-lg"></span></div>;
    }

    if (!artistData) {
        return <div className="text-center p-8">No data for this artist.</div>;
    }

    const masterCount = artistData.releases.filter(r => r.type === 'master').length;
    const releaseCount = artistData.releases.filter(r => r.type === 'release').length;

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col md:flex-row gap-8">
                
                {/* Section artiste */}
                <div className="md:w-1/3 lg:w-1/4 flex-shrink-0">
                    {artistData.artistImage && (
                        <img src={artistData.artistImage} alt={artistData.artistName} className="w-full h-auto object-cover rounded-lg shadow-2xl" />
                    )}
                    <h1 className="text-2xl font-bold mt-4">{artistData.artistName}</h1>
                    <p className="text-gray-400">Discography</p>
                    <div className="stats shadow mt-4">
                        <div className="stat">
                            <div className="stat-title">Total Albums</div>
                            <div className="stat-value text-primary">{groupedReleases.length}</div>
                        </div>
                    </div>
                </div>

                {/* Liste des albums */}
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <p className="text-sm">Filter by:</p>
                            <button onClick={() => setFilter('all')} className={`btn btn-xs ${filter === 'all' ? 'btn-active btn-neutral' : ''}`}>
                                All <div className="badge badge-primary ml-2">{groupedReleases.length}</div>
                            </button>
                            {masterCount > 0 && (
                                <button onClick={() => setFilter('master')} className={`btn btn-xs ${filter === 'master' ? 'btn-active btn-neutral' : ''}`}>
                                    Masters <div className="badge badge-primary ml-2">{masterCount}</div>
                                </button>
                            )}
                            {releaseCount > 0 && (
                                <button onClick={() => setFilter('release')} className={`btn btn-xs ${filter === 'release' ? 'btn-active btn-neutral' : ''}`}>
                                    Releases <div className="badge badge-primary ml-2">{releaseCount}</div>
                                </button>
                            )}
                        </div>
                        <Link to="/" className="btn btn-sm btn-outline">Return to Homepage</Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupedReleases.map((album) => (
                            <div 
                                key={`${album.type}-${album.id}`}
                                onClick={() => handleAlbumClick(album)}
                                className="card bg-base-200 shadow-xl hover:shadow-2xl transition-all cursor-pointer hover:scale-105"
                            >
                                <figure className="px-4 pt-4">
                                    <img 
                                        src={album.thumb || '/placeholder-album.png'} 
                                        alt={album.title}
                                        className="rounded-xl w-full h-48 object-cover"
                                    />
                                </figure>
                                <div className="card-body p-4">
                                    <h2 className="card-title text-base leading-tight">
                                        {album.title}
                                        <div className="badge badge-secondary badge-sm">{album.type}</div>
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        {album.year} • {album.format}
                                    </p>
                                    <p className="text-xs text-gray-400">{album.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {groupedReleases.length === 0 && (
                        <div className="text-center p-8 bg-base-200 rounded-box">
                            <p>No albums found with the selected filter.</p>
                        </div>
                    )}
                </div>
            </div>
            <ToastContainer />
        </div>
    );
};

export default ArtistAlbumsPage;