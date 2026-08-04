import React, { useEffect, useState, useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useParams, useNavigate } from 'react-router';
import { getArtistReleases } from '../api/discogs';
import { useTranslation } from 'react-i18next';
import { isRateLimitError } from '../api/errors';
import { stripArtistSuffix } from '../utils/formatters';
import type { ArtistPageData, ArtistAlbum } from '../types/discogs.types';
import { getImageUrl } from '../utils/imageUrl';
import BackButton from '../components/Common/BackButton';
import PageLoadError from '../components/Common/PageLoadError';

type SortField = 'title' | 'year';
type SortOrder = 'asc' | 'desc';

interface ArtistPageState {
    sortField: SortField;
    sortOrder: SortOrder;
}

const ARTIST_PAGE_STATE_KEY = 'musivault_artist_page_state';

const getStoredState = (artistId: string): ArtistPageState | null => {
    try {
        const stored = sessionStorage.getItem(`${ARTIST_PAGE_STATE_KEY}_${artistId}`);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        // Ignore parse errors
    }
    return null;
};

const ArtistAlbumsPage: React.FC = () => {
    const { artistId } = useParams<{ artistId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [pageData, setPageData] = useState<ArtistPageData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    /** Bumped by the retry button to re-run the fetch effect. */
    const [retryCount, setRetryCount] = useState<number>(0);

    // Initialize state from sessionStorage if available
    const storedState = artistId ? getStoredState(artistId) : null;
    const [sortField, setSortField] = useState<SortField>(storedState?.sortField ?? 'year');
    const [sortOrder, setSortOrder] = useState<SortOrder>(storedState?.sortOrder ?? 'desc');
    const [searchTerm, setSearchTerm] = useState<string>('');

    // Save state to sessionStorage whenever it changes
    useEffect(() => {
        if (!artistId) return;
        const state: ArtistPageState = {
            sortField,
            sortOrder
        };
        sessionStorage.setItem(`${ARTIST_PAGE_STATE_KEY}_${artistId}`, JSON.stringify(state));
    }, [artistId, sortField, sortOrder]);

    useEffect(() => {
        const fetchArtistAlbums = async () => {
            if (!artistId) return;
            setIsLoading(true);
            setLoadError(null);
            try {
                setPageData(await getArtistReleases(artistId, { sort: sortField, order: sortOrder }));
            } catch (error) {
                console.error('Error loading artist albums:', error);
                setLoadError(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchArtistAlbums();
    }, [artistId, sortField, sortOrder, retryCount]);

    const sortedAlbums = useMemo(() => {
        if (!pageData) return [];

        let result = pageData.albums;

        if (searchTerm.trim() !== '') {
            const lowerQuery = searchTerm.toLowerCase();
            result = result.filter(a => a.title.toLowerCase().includes(lowerQuery));
        }

        return [...result].sort((a, b) => {
            if (sortField === 'title') {
                const comparison = a.title.localeCompare(b.title);
                return sortOrder === 'asc' ? comparison : -comparison;
            } else {
                const comparison = a.year - b.year;
                return sortOrder === 'asc' ? comparison : -comparison;
            }
        });
    }, [pageData, sortField, sortOrder, searchTerm]);

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

    if (loadError) {
        return (
            <PageLoadError
                isRateLimited={isRateLimitError(loadError)}
                message={t('artist.errorLoading')}
                onRetry={() => setRetryCount(c => c + 1)}
            />
        );
    }

    if (!pageData) {
        return <div className="text-center p-8">{t('artist.noData')}</div>;
    }

    return (
        <div className="p-4 md:p-8">
            <BackButton />

            {/* Header with artist info */}
            <div className="flex flex-col md:flex-row gap-6 mb-8">
                {pageData.artist.image && (
                    <img
                        src={getImageUrl(pageData.artist.image)}
                        alt={pageData.artist.name}
                        className="w-32 h-32 md:w-48 md:h-48 rounded-full object-cover shadow-xl mx-auto md:mx-0"
                    />
                )}
                <div className="flex flex-col justify-center text-center md:text-left">
                    <h1 className="text-3xl md:text-4xl font-bold">{stripArtistSuffix(pageData.artist.name)}</h1>
                    <p className="text-base-content/70 mt-2">{pageData.albums.length} {t('common.albums')}</p>
                </div>
            </div>

            {/* Filter and Sort controls */}
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-6 p-4 bg-base-200 rounded-lg">
                <div className="w-full md:max-w-sm">
                    <input
                        type="text"
                        placeholder={t('search.placeholder', 'Search...')}
                        className="input input-sm w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium">{t('artist.sortBy')}</span>
                    <div className="flex gap-2">
                        <button
                            className={`btn btn-sm ${sortField === 'title' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setSortField('title')}
                        >
                            {t('common.title')}
                        </button>
                        <button
                            className={`btn btn-sm ${sortField === 'year' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setSortField('year')}
                        >
                            {t('common.year')}
                        </button>
                    </div>
                    <div className="divider divider-horizontal mx-0 hidden md:flex"></div>
                    <button
                        className="btn btn-sm btn-ghost gap-2"
                        onClick={toggleSortOrder}
                    >
                        {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                        {sortOrder === 'asc' ? t('artist.ascending') : t('artist.descending')}
                    </button>
                </div>
            </div>

            {/* Albums List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                {sortedAlbums.map((album) => (
                    <div
                        key={`${album.type}-${album.id}`}
                        className="flex items-center gap-3 lg:gap-4 p-2 lg:p-3 bg-base-200 rounded-xl hover:bg-base-300 cursor-pointer transition-all hover:scale-[1.01] shadow-xs group"
                        onClick={() => handleAlbumClick(album)}
                    >
                        <img
                            src={getImageUrl(album.thumb || '/placeholder-album.svg')}
                            alt={album.title}
                            className="w-14 h-14 sm:w-16 sm:h-16 lg:w-[150px] lg:h-[150px] object-cover rounded-lg shadow-xs shrink-0 group-hover:shadow-md transition-shadow"
                            loading="lazy"
                        />
                        <div className="flex flex-col justify-center min-w-0 flex-1 py-0 lg:py-1">
                            <h3 className="font-bold text-sm sm:text-base lg:text-xl line-clamp-2 group-hover:text-primary transition-colors leading-tight lg:leading-normal">{album.title}</h3>
                            <p className="text-xs sm:text-sm lg:text-base text-base-content/60 mt-0.5 lg:mt-2 font-medium">
                                {album.year > 0 ? album.year : t('artist.unknownYear')}
                            </p>
                        </div>
                        <div className="px-1 lg:px-6 opacity-0 group-hover:opacity-100 transition-opacity text-base-content/30 group-hover:text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </div>
                    </div>
                ))}
            </div>

            {sortedAlbums.length === 0 && (
                <div className="text-center py-12 text-base-content/70">
                    {t('artist.noAlbums')}
                </div>
            )}
        </div>
    );
};

export default ArtistAlbumsPage;
