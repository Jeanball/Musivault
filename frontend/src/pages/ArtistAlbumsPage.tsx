import React, { useEffect, useState, useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useParams, useNavigate } from 'react-router';
import { getArtistReleases } from '../api/discogs';
import { useTranslation } from 'react-i18next';
import { isRateLimitError } from '../api/errors';
import { stripDiscogsSuffix } from '../utils/formatters';
import type { ArtistPageData, ArtistAlbum, DiscogsResult } from '../types/discogs.types';
import { getImageUrl } from '../utils/imageUrl';
import BackButton from '../components/Common/BackButton';
import PageLoadError from '../components/Common/PageLoadError';
import SearchField from '../components/Search/SearchField';
import SearchResultCard from '../components/Search/SearchResultCard';

type SortField = 'title' | 'year';
type SortOrder = 'asc' | 'desc';

interface ArtistPageState {
    sortField: SortField;
    sortOrder: SortOrder;
}

const ARTIST_PAGE_STATE_KEY = 'musivault_artist_page_state';

/**
 * The artist endpoint returns less than a search hit, so the row simply gets
 * fewer badges. A year of 0 means Discogs doesn't know it: no badge rather than
 * an "unknown year" placeholder.
 */
const toSearchResult = (album: ArtistAlbum): DiscogsResult => ({
    id: album.id,
    title: album.title,
    thumb: album.thumb,
    type: album.type,
    year: album.year > 0 ? String(album.year) : ''
});

const getStoredState = (artistId: string): ArtistPageState | null => {
    try {
        const stored = sessionStorage.getItem(`${ARTIST_PAGE_STATE_KEY}_${artistId}`);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
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
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <BackButton />

            {/* Header: the portrait becomes a faded backdrop with the name over it.
                Stacked and centred, it used to eat a third of a phone screen before
                a single album showed up. The gradient lands on base-100 exactly where
                the text sits, so contrast holds in both themes. */}
            <div className="relative -mx-4 md:-mx-8 -mt-2 mb-4 md:mb-6 overflow-hidden min-h-56 md:min-h-96 flex items-end">
                {pageData.artist.image && (
                    <>
                        {/* Two layers, the way Plex fills a backdrop: a blurred copy
                            paints the whole band, the sharp photo sits on top scaled to
                            full height. Portraits are never cut off at the bottom, and
                            what overflows does so on the sides. */}
                        <img
                            src={getImageUrl(pageData.artist.image)}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-70"
                        />
                        <img
                            src={getImageUrl(pageData.artist.image)}
                            alt=""
                            aria-hidden="true"
                            className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-auto max-w-none"
                        />
                        {/* The veil is concentrated in the bottom third, under the name:
                            the photo stays legible above, the text stays readable on both
                            themes below. */}
                        <div className="absolute inset-0 bg-linear-to-t from-base-100 from-5% via-base-100/45 via-45% to-transparent to-95%" />
                    </>
                )}
                <div className="relative w-full px-4 md:px-8 pt-20 pb-4 md:pt-52 md:pb-6">
                    <h1 className="text-2xl md:text-4xl font-bold leading-tight">
                        {stripDiscogsSuffix(pageData.artist.name)}
                    </h1>
                    <p className="text-sm md:text-base text-base-content/70 mt-1">
                        {pageData.albums.length} {t('common.albums')}
                    </p>
                </div>
            </div>

            {/* Filter and Sort controls */}
            <div className="flex flex-col md:flex-row justify-between gap-3 md:gap-4 mb-4 md:mb-6 p-3 md:p-4 bg-base-200 rounded-box">
                <div className="w-full md:max-w-sm">
                    <SearchField
                        value={searchTerm}
                        onChange={setSearchTerm}
                        onReset={() => setSearchTerm('')}
                        resetLabel={t('search.resetSearch')}
                        placeholder={t('artist.filterPlaceholder')}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                    <span className="text-sm font-medium hidden md:inline">{t('artist.sortBy')}</span>
                    <div className="flex gap-2">
                        <button
                            className={`btn btn-sm h-11 min-h-11 md:h-8 md:min-h-8 ${sortField === 'title' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setSortField('title')}
                        >
                            {t('common.title')}
                        </button>
                        <button
                            className={`btn btn-sm h-11 min-h-11 md:h-8 md:min-h-8 ${sortField === 'year' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setSortField('year')}
                        >
                            {t('common.year')}
                        </button>
                    </div>
                    <div className="divider divider-horizontal mx-0 hidden md:flex"></div>
                    <button
                        className="btn btn-sm btn-ghost gap-2 h-11 min-h-11 md:h-8 md:min-h-8 ml-auto md:ml-0"
                        onClick={toggleSortOrder}
                    >
                        {sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                        {sortOrder === 'asc' ? t('artist.ascending') : t('artist.descending')}
                    </button>
                </div>
            </div>

            {/* Albums: the same row as the search results, so an album looks the
                same wherever it is listed. The artist is in the page title, so the
                rows don't repeat it. */}
            <div className="border-t border-base-300 sm:border-0 sm:space-y-3">
                {sortedAlbums.map((album) => (
                    <SearchResultCard
                        key={`${album.type}-${album.id}`}
                        result={toSearchResult(album)}
                        artistName={null}
                        onShowDetails={() => handleAlbumClick(album)}
                    />
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
