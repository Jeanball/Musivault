import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import axios from 'axios';
import { toastService } from '../utils/toast';
import type { ArtistPageData, ArtistAlbum } from '../types';

type SortField = 'title' | 'year';
type SortOrder = 'asc' | 'desc';

const ArtistAlbumsPage: React.FC = () => {
    const { artistId } = useParams<{ artistId: string }>();
    const navigate = useNavigate();
    const [pageData, setPageData] = useState<ArtistPageData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [sortField, setSortField] = useState<SortField>('year');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    useEffect(() => {
        const fetchArtistAlbums = async () => {
            if (!artistId) return;
            try {
                const { data } = await axios.get<ArtistPageData>(`/api/discogs/artist/${artistId}/releases`, {
                    params: { sort: sortField, order: sortOrder },
                    withCredentials: true
                });
                setPageData(data);
            } catch (error) {
                console.log("Error loading artist albums:", error);
                toastService.error("Error loading artist albums.");
                navigate('/app');
            } finally {
                setIsLoading(false);
            }
        };
        fetchArtistAlbums();
    }, [artistId, sortField, sortOrder, navigate]);

    const sortedAlbums = useMemo(() => {
        if (!pageData) return [];

        return [...pageData.albums].sort((a, b) => {
            if (sortField === 'title') {
                const comparison = a.title.localeCompare(b.title);
                return sortOrder === 'asc' ? comparison : -comparison;
            } else {
                const comparison = a.year - b.year;
                return sortOrder === 'asc' ? comparison : -comparison;
            }
        });
    }, [pageData, sortField, sortOrder]);

    const handleAlbumClick = (album: ArtistAlbum) => {
        if (album.type === 'master') {
            navigate(`/app/master/${album.id}`);
        } else {
            navigate(`/app/release/${album.id}`);
        }
    };

    const toggleSortOrder = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (!pageData) {
        return <div className="text-center p-8">No data for this artist.</div>;
    }

    return (
        <div className="p-4 md:p-8">
            {/* Header with artist info */}
            <div className="flex flex-col md:flex-row gap-6 mb-8">
                {pageData.artist.image && (
                    <img
                        src={pageData.artist.image}
                        alt={pageData.artist.name}
                        className="w-32 h-32 md:w-48 md:h-48 rounded-full object-cover shadow-xl mx-auto md:mx-0"
                    />
                )}
                <div className="flex flex-col justify-center text-center md:text-left">
                    <h1 className="text-3xl md:text-4xl font-bold">{pageData.artist.name}</h1>
                    <p className="text-gray-400 mt-2">{pageData.albums.length} albums</p>
                    <button onClick={() => navigate(-1)} className="btn btn-outline btn-sm mt-4 w-fit mx-auto md:mx-0">
                        ← Back
                    </button>
                </div>
            </div>

            {/* Sort controls */}
            <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-base-200 rounded-lg">
                <span className="text-sm font-medium">Sort by:</span>
                <div className="flex gap-2">
                    <button
                        className={`btn btn-sm ${sortField === 'title' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setSortField('title')}
                    >
                        Title
                    </button>
                    <button
                        className={`btn btn-sm ${sortField === 'year' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setSortField('year')}
                    >
                        Year
                    </button>
                </div>
                <div className="divider divider-horizontal mx-0"></div>
                <button
                    className="btn btn-sm btn-ghost"
                    onClick={toggleSortOrder}
                >
                    {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
            </div>

            {/* Albums grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortedAlbums.map((album) => (
                    <div
                        key={`${album.type}-${album.id}`}
                        className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-all hover:scale-105"
                        onClick={() => handleAlbumClick(album)}
                    >
                        <figure className="px-3 pt-3">
                            <img
                                src={album.thumb || '/placeholder-album.png'}
                                alt={album.title}
                                className="rounded-lg w-full aspect-square object-cover"
                            />
                        </figure>
                        <div className="card-body p-3">
                            <h3 className="card-title text-sm line-clamp-2">{album.title}</h3>
                            <p className="text-xs text-gray-400">
                                {album.year > 0 ? album.year : 'Unknown year'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {sortedAlbums.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    No albums found for this artist.
                </div>
            )}
        </div>
    );
};

export default ArtistAlbumsPage;
