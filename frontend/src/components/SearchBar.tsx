import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { toast } from "react-toastify";
import AlbumCard from './AlbumCard';
import type { DiscogsResult } from '../types';

const BATCH_SIZE = 5;

const SearchBar: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<DiscogsResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
    const navigate = useNavigate();

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setVisibleCount(BATCH_SIZE);
        setIsLoading(true);
        setSearchResults([]);
        try {
            const response = await axios.get<DiscogsResult[]>(`/api/discogs/search`, {
                params: { q: searchQuery }, 
                withCredentials: true
            });
            setSearchResults(response.data);
        } catch (err) {
            console.log(err)
            toast.error("Search failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    };

    const handleShowMore = () => {
        setVisibleCount(prevCount => prevCount + BATCH_SIZE);
    };

    const handleSelectMaster = (masterId: number) => {
        navigate(`/master/${masterId}`);
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-8">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Search an album..."
                    className="flex-grow input input-bordered"
                />
                <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="btn btn-primary"
                >
                    {isLoading ? <span className="loading loading-spinner"></span> : 'Search'}
                </button>
            </div>

            <div className="space-y-4 mt-8">
                {searchResults.slice(0, visibleCount).map((result) => (
                   <AlbumCard
                        key={result.id}
                        result={result}
                        onShowDetails={() => handleSelectMaster(result.id)}
                        isLoadingDetails={false}
                   />
                ))}
            </div>
            
            {searchResults.length > visibleCount && (
                <div className="mt-8 text-center">
                    <button onClick={handleShowMore} className="btn btn-accent">
                        Voir plus
                    </button>
                </div>
            )}
        </div>
    );
};

export default SearchBar;