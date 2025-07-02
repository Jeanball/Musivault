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

    const handleSelectMaster = (masterId: number) => {
        navigate(`/master/${masterId}`);
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
                        onShowDetails={() => handleSelectMaster(result.id)}
                        isLoadingDetails={false}
                   />
                ))}
            </div>
        </div>
    );
};

export default SearchBar;
