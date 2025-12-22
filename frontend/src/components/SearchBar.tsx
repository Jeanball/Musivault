import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { toastService } from "../utils/toast";
import AlbumCard from './AlbumCard';
import BarcodeScannerModal from './Modal/BarcodeScannerModal';
import SelectReleaseModal from './Modal/SelectReleaseModal';
import type { DiscogsResult, ArtistResult } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { Camera } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

type SearchType = 'album' | 'artist';

interface ReleaseDetails {
    discogsId: number;
    title: string;
    artist: string;
    year: string;
    cover_image: string;
    availableFormats?: { name: string; descriptions: string[]; text: string }[];
}

const SearchBar: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchType, setSearchType] = useState<SearchType>('album');
    const [albumResults, setAlbumResults] = useState<DiscogsResult[]>([]);
    const [artistResults, setArtistResults] = useState<ArtistResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
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

            const search = async () => {
                try {
                    if (searchType === 'album') {
                        const response = await axios.get<DiscogsResult[]>(`${API_BASE_URL}/api/discogs/search`, {
                            params: { q: debouncedSearchQuery },
                            withCredentials: true
                        });
                        setAlbumResults(Array.isArray(response.data) ? response.data : []);
                        setArtistResults([]);
                    } else {
                        const response = await axios.get<ArtistResult[]>(`${API_BASE_URL}/api/discogs/search/artists`, {
                            params: { q: debouncedSearchQuery },
                            withCredentials: true
                        });
                        setArtistResults(Array.isArray(response.data) ? response.data : []);
                        setAlbumResults([]);
                    }
                } catch (err) {
                    console.log(err)
                    if (axios.isAxiosError(err) && err.response?.status === 429) {
                        toastService.error("Discogs rate limit reached. Please wait a moment and try again.");
                    } else {
                        toastService.error("Search failed.");
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
    }, [debouncedSearchQuery, searchType]);

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
        toastService.info(`Searching for barcode: ${barcode}`);

        try {
            const response = await axios.get<DiscogsResult[]>(`${API_BASE_URL}/api/discogs/search/barcode`, {
                params: { barcode },
                withCredentials: true
            });

            const results = response.data;

            if (results.length === 0) {
                toastService.error("No albums found with this barcode.");
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
                toastService.error("Discogs rate limit reached. Please wait a moment and try again.");
            } else if (axios.isAxiosError(err) && err.response?.data?.message) {
                toastService.error(err.response.data.message);
            } else {
                toastService.error("Failed to search barcode.");
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

            toastService.success(`"${releaseDetails.title}" added to your collection!`);
        } catch (err: unknown) {
            console.error('Error adding to collection:', err);
            if (axios.isAxiosError(err) && err.response?.data?.message) {
                toastService.error(err.response.data.message);
            } else {
                toastService.error("Failed to add album to collection.");
            }
        } finally {
            setIsAddingFromBarcode(false);
            setIsSelectModalOpen(false);
        }
    };

    const handleSelectFromBarcode = (release: DiscogsResult) => {
        addReleaseToCollection(release.id);
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Search filter */}
            <div className="flex gap-2 mb-4 justify-center">
                <button
                    className={`btn btn-sm ${searchType === 'album' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setSearchType('album')}
                >
                    Albums
                </button>
                <button
                    className={`btn btn-sm  ${searchType === 'artist' ? 'btn-primary' : 'btn-outline'} `}
                    onClick={() => setSearchType('artist')}
                >
                    Artists
                </button>
            </div>

            {/* Search bar with barcode scanner button */}
            <div className="relative flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchType === 'album' ? "Search for an album..." : "Search for an artist..."}
                        className="input input-bordered w-full pr-10"
                        autoFocus
                    />
                    {isLoading && (
                        <span className="loading loading-spinner loading-sm absolute top-1/2 right-3 -translate-y-1/2"></span>
                    )}
                </div>
                <button
                    className="btn btn-primary btn-square"
                    onClick={() => setIsScannerOpen(true)}
                    title="Scan Barcode"
                    disabled={isAddingFromBarcode}
                >
                    {isAddingFromBarcode ? (
                        <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                        <Camera className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* Album results */}
            {searchType === 'album' && (
                <div className="space-y-4 mt-8">
                    {albumResults.map((result) => (
                        <AlbumCard
                            key={result.id}
                            result={result}
                            onShowDetails={() => handleSelectAlbum(result)}
                            isLoadingDetails={false}
                        />
                    ))}
                </div>
            )}

            {/* Artist results */}
            {searchType === 'artist' && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
                    {artistResults.map((artist) => (
                        <div
                            key={artist.id}
                            className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors"
                            onClick={() => handleSelectArtist(artist)}
                        >
                            <figure className="px-4 pt-4">
                                <img
                                    src={artist.thumb || '/placeholder-artist.png'}
                                    alt={artist.name}
                                    className="rounded-full w-24 h-24 object-cover mx-auto"
                                />
                            </figure>
                            <div className="card-body items-center text-center p-4">
                                <h3 className="card-title text-sm">{artist.name}</h3>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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

