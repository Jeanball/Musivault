import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { toastService } from "../utils/toast";
import AlbumCard from './AlbumCard';
import type { DiscogsResult, ArtistResult } from '../types';
import { useDebounce } from '../hooks/useDebounce';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

type SearchType = 'album' | 'artist';

const SearchBar: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchType, setSearchType] = useState<SearchType>('album');
    const [albumResults, setAlbumResults] = useState<DiscogsResult[]>([]);
    const [artistResults, setArtistResults] = useState<ArtistResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const navigate = useNavigate();

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
                    toastService.error("Search failed.");
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

            {/* Search bar */}
            <div className="relative">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchType === 'album' ? "Search for an album..." : "Search for an artist..."}
                    className="input input-bordered w-full pr-10"
                />
                {isLoading && (
                    <span className="loading loading-spinner loading-sm absolute top-1/2 right-3 -translate-y-1/2"></span>
                )}
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
        </div>
    );
};

export default SearchBar;
