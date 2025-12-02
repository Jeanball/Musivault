import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { toast } from "react-toastify";
import AlbumCard from './AlbumCard';
import type { DiscogsResult } from '../types';
import { useDebounce } from '../hooks/useDebounce'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const SearchBar: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<DiscogsResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const navigate = useNavigate();

    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    useEffect(() => {
        if (debouncedSearchQuery.length > 2) {
            setIsLoading(true);
            
            const search = async () => {
                try {
                    const response = await axios.get<DiscogsResult[]>(`${API_BASE_URL}/api/discogs/search`, {
                        params: { q: debouncedSearchQuery }, 
                        withCredentials: true
                    });
                    
                    if (Array.isArray(response.data)) {
                        setSearchResults(response.data);
                    } else {
                        setSearchResults([]);
                    }

                } catch (err) {
                    console.log(err)
                    toast.error("Search failed.");
                    setSearchResults([]);
                } finally {
                    setIsLoading(false);
                }
            };
            search();
        } else {
            setSearchResults([]);
        }
    }, [debouncedSearchQuery]);

    const handleSelectResult = (result: DiscogsResult) => {
        if (result.type === 'artist') {
            // C'est un artiste, on va vers sa discographie
            navigate(`/app/artist/${result.id}`);
        } else if (result.type === 'master') {
            // C'est un master, on va directement à ses versions
            navigate(`/app/master/${result.id}`);
        } else if (result.master_id) {
            // C'est une release avec un master parent, on va vers le master
            navigate(`/app/master/${result.master_id}`);
        } else {
            // Release orpheline, on utilise la nouvelle route
            navigate(`/app/release/${result.id}`);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="relative">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Start typing to find an album..."
                    className="input input-bordered w-full pr-10"
                />
                {isLoading && (
                    <span className="loading loading-spinner loading-sm absolute top-1/2 right-3 -translate-y-1/2"></span>
                )}
            </div>

            <div className="space-y-4 mt-8">
                {searchResults.map((result) => (
                   <AlbumCard
                        key={result.id}
                        result={result}
                        onShowDetails={() => handleSelectResult(result)}
                        isLoadingDetails={false}
                   />
                ))}
            </div>
        </div>
    );
};

export default SearchBar;
