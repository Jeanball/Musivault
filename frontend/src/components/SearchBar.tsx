import React, { useState } from 'react';
import axios from 'axios';
import AlbumCard from './AlbumCard';
import type { DiscogsResult } from '../types';

const BATCH_SIZE = 5;



const SearchBar = () => {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<DiscogsResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);
   
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setVisibleCount(BATCH_SIZE); 
        setIsLoading(true);
        setError(null);
        setSearchResults([]);

        try {
            const response = await axios.get<DiscogsResult[]>(
                'http://localhost:5001/api/discogs/search', { params: { q: searchQuery } }
            );
            console.log(response.data)
            setSearchResults(response.data);

        } catch (err) {
            if (axios.isAxiosError(err)) {
                setError(err.message);
            } else {
                setError('An unexpected error occurred.');
            }
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

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Search Input and Button */}
            <div className="flex items-center gap-2 mb-8">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Search for an artist or release..."
                    className="flex-grow px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-150 ease-in-out"
                />
                <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="px-6 py-2 font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                         <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                    ) : (
                        'Search'
                    )}
                </button>
            </div>

            {/* Error Message Display */}
            {error && <p className="text-red-500 text-center">{error}</p>}

            <div className="space-y-4">
                {searchResults.slice(0, visibleCount).map((result) => (
                   <AlbumCard key={result.id} result={result} />
                ))}
            </div>

            {/* --- NEW: Conditional "Show More" Button --- */}
            {searchResults.length > visibleCount && (
                <div className="mt-8 text-center">
                    <button
                        onClick={handleShowMore}
                        className="px-6 py-2 font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out"
                    >
                        Show More
                    </button>
                </div>
            )}
        </div>
    );
}

export default SearchBar;