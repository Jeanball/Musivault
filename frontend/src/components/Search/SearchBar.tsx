import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toastService } from "../../utils/toast";
import { stripArtistSuffix } from '../../utils/formatters';
import AlbumCard from '../Collection/AlbumCard';
import BarcodeScannerModal from '../Modal/BarcodeScannerModal';
import SelectReleaseModal from '../Modal/SelectReleaseModal';
import type { DiscogsResult, ArtistResult } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import { Camera, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface ReleaseDetails {
    discogsId: number;
    title: string;
    artist: string;
    year: string;
    cover_image: string;
    availableFormats?: { name: string; descriptions: string[]; text: string }[];
}

const SearchBar: React.FC = () => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState<string>('');
    // Unified search: no searchType toggle
    const [albumResults, setAlbumResults] = useState<DiscogsResult[]>([]);
    const [artistResults, setArtistResults] = useState<ArtistResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Incremental expansion: number of visible items
    const [visibleArtistCount, setVisibleArtistCount] = useState(3);
    const [visibleAlbumCount, setVisibleAlbumCount] = useState(5);

    const navigate = useNavigate();

    // Barcode scanner state
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [barcodeResults, setBarcodeResults] = useState<DiscogsResult[]>([]);
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
    const [isAddingFromBarcode, setIsAddingFromBarcode] = useState(false);

    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    useEffect(() => {
        if (debouncedSearchQuery.length > 2) {
            setIsLoading(true);
            // Reset to initial counts on new search
            setVisibleArtistCount(3);
            setVisibleAlbumCount(5);

            const search = async () => {
                try {
                    // Execute both searches in parallel
                    const [albumsRes, artistsRes] = await Promise.all([
                        axios.get<DiscogsResult[]>(`${API_BASE_URL}/api/discogs/search`, {
                            params: { q: debouncedSearchQuery },
                            withCredentials: true
                        }),
                        axios.get<ArtistResult[]>(`${API_BASE_URL}/api/discogs/search/artists`, {
                            params: { q: debouncedSearchQuery },
                            withCredentials: true
                        })
                    ]);

                    setAlbumResults(Array.isArray(albumsRes.data) ? albumsRes.data : []);
                    setArtistResults(Array.isArray(artistsRes.data) ? artistsRes.data : []);

                } catch (err) {
                    console.log(err)
                    if (axios.isAxiosError(err) && err.response?.status === 429) {
                        toastService.error(t('search.tooManyRequests'));
                    } else {
                        // Don't show error toast on every keystroke/search, just log
                        console.error("Search failed");
                    }
                    setAlbumResults([]);
                    setArtistResults([]);
                } finally {
                    setIsLoading(false);
                }
            };
            search();
        } else {
            setAlbumResults([]);
            setArtistResults([]);
        }
    }, [debouncedSearchQuery]); // Removed searchType dependency

    const handleSelectAlbum = (result: DiscogsResult) => {
        if (result.type === 'master') {
            navigate(`/app/master/${result.id}`);
        } else {
            navigate(`/app/release/${result.id}`);
        }
    };

    const handleSelectArtist = (artist: ArtistResult) => {
        navigate(`/app/artist/${artist.id}`);
    };

    // Barcode scanning handlers
    const handleScanSuccess = async (barcode: string) => {
        setIsScannerOpen(false);
        setIsAddingFromBarcode(true);
        toastService.info(t('search.searchingBarcode', { barcode }));

        try {
            const response = await axios.get<DiscogsResult[]>(`${API_BASE_URL}/api/discogs/search/barcode`, {
                params: { barcode },
                withCredentials: true
            });

            const results = response.data;

            if (results.length === 0) {
                toastService.error(t('search.noBarcodeResults'));
            } else if (results.length === 1) {
                // Auto-add the single result
                await addReleaseToCollection(results[0].id);
            } else {
                // Multiple results - show selection modal
                setBarcodeResults(results);
                setIsSelectModalOpen(true);
            }
        } catch (err) {
            console.error('Barcode search error:', err);
            if (axios.isAxiosError(err) && err.response?.status === 429) {
                toastService.error(t('search.tooManyRequests'));
            } else if (axios.isAxiosError(err) && err.response?.data?.message) {
                toastService.error(err.response.data.message);
            } else {
                toastService.error(t('search.failedSearch'));
            }
        } finally {
            setIsAddingFromBarcode(false);
        }
    };

    const addReleaseToCollection = async (releaseId: number) => {
        setIsAddingFromBarcode(true);
        try {
            // Fetch release details first
            const { data: releaseDetails } = await axios.get<ReleaseDetails>(
                `${API_BASE_URL}/api/discogs/release/${releaseId}`,
                { withCredentials: true }
            );

            // Use the first available format, or create a default
            const format = releaseDetails.availableFormats?.[0] || {
                name: 'Unknown',
                descriptions: [],
                text: ''
            };

            // Add to collection
            await axios.post(
                `${API_BASE_URL}/api/collection`,
                { ...releaseDetails, format },
                { withCredentials: true }
            );

            toastService.success(t('search.addedToCollection', { title: releaseDetails.title }));
        } catch (err: unknown) {
            console.error('Error adding to collection:', err);
            if (axios.isAxiosError(err) && err.response?.data?.message) {
                toastService.error(err.response.data.message);
            } else {
                toastService.error(t('search.failedAddToCollection'));
            }
        } finally {
            setIsAddingFromBarcode(false);
            setIsSelectModalOpen(false);
        }
    };

    const handleSelectFromBarcode = (release: DiscogsResult) => {
        addReleaseToCollection(release.id);
    };

    // Reset search handler
    const handleResetSearch = () => {
        setSearchQuery('');
        setAlbumResults([]);
        setArtistResults([]);
        setVisibleArtistCount(3);
        setVisibleAlbumCount(5);
    };

    // Rendering Helpers
    const visibleArtists = artistResults.slice(0, visibleArtistCount);
    const visibleAlbums = albumResults.slice(0, visibleAlbumCount);
    const hasResults = artistResults.length > 0 || albumResults.length > 0;

    return (
        <div className="w-full max-w-6xl mx-auto">
            {/* Search bar with barcode scanner and reset buttons */}
            <div className="relative flex gap-2 mb-6">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('search.placeholder')}
                        className="input input-bordered w-full pr-10"
                        autoFocus
                    />
                    {isLoading && (
                        <span className="loading loading-spinner loading-sm absolute top-1/2 right-3 -translate-y-1/2"></span>
                    )}
                </div>
                {/* Reset button - only show when there are results or a query */}
                {(searchQuery || hasResults) && (
                    <button
                        className="btn btn-ghost btn-square"
                        onClick={handleResetSearch}
                        title={t('search.resetSearch')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
                <button
                    className="btn btn-primary btn-square"
                    onClick={() => setIsScannerOpen(true)}
                    title={t('search.scanBarcode')}
                    disabled={isAddingFromBarcode}
                >
                    {isAddingFromBarcode ? (
                        <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                        <Camera className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Side-by-side layout: Artists left, Albums right */}
            <div className="flex flex-col md:flex-row gap-8">

                {/* ARTISTS SECTION - Left side */}
                {artistResults.length > 0 && (
                    <div className="md:w-1/3">
                        <h3 className="text-xl font-bold mb-4 text-gray-200">{t('search.artists')}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
                            {visibleArtists.map((artist) => (
                                <div
                                    key={artist.id}
                                    className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors"
                                    onClick={() => handleSelectArtist(artist)}
                                >
                                    <figure className="px-4 pt-4">
                                        <img
                                            src={artist.thumb || '/placeholder-artist.png'}
                                            alt={stripArtistSuffix(artist.name)}
                                            className="rounded-full w-20 h-20 object-cover mx-auto"
                                        />
                                    </figure>
                                    <div className="card-body items-center text-center p-3">
                                        <h3 className="card-title text-sm">{stripArtistSuffix(artist.name)}</h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {visibleArtistCount < artistResults.length && (
                            <button
                                className="btn btn-ghost btn-sm mt-2 w-full text-gray-400 hover:text-white"
                                onClick={() => setVisibleArtistCount(prev => prev + 3)}
                            >
                                {t('search.showMore', { count: 3, remaining: artistResults.length - visibleArtistCount })}
                            </button>
                        )}
                    </div>
                )}

                {/* ALBUMS SECTION - Right side */}
                {albumResults.length > 0 && (
                    <div className="md:w-2/3">
                        <h3 className="text-xl font-bold mb-4 text-gray-200">{t('common.albums')}</h3>
                        <div className="space-y-4">
                            {visibleAlbums.map((result) => (
                                <AlbumCard
                                    key={result.id}
                                    result={result}
                                    onShowDetails={() => handleSelectAlbum(result)}
                                    isLoadingDetails={false}
                                />
                            ))}
                        </div>
                        {visibleAlbumCount < albumResults.length && (
                            <button
                                className="btn btn-ghost btn-sm mt-2 w-full text-gray-400 hover:text-white"
                                onClick={() => setVisibleAlbumCount(prev => prev + 5)}
                            >
                                {t('search.showMore', { count: 5, remaining: albumResults.length - visibleAlbumCount })}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Barcode Scanner Modal */}
            <BarcodeScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
            />

            {/* Select Release Modal (for multiple barcode matches) */}
            <SelectReleaseModal
                isOpen={isSelectModalOpen}
                results={barcodeResults}
                onClose={() => setIsSelectModalOpen(false)}
                onSelect={handleSelectFromBarcode}
                isLoading={isAddingFromBarcode}
            />
        </div>
    );
};

export default SearchBar;

