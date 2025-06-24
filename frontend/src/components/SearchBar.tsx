import React, { useState } from 'react';
import axios from 'axios';
import { toast } from "react-toastify";
import AlbumCard from './AlbumCard';
import AlbumDetailModal, { type AlbumDetails } from './AlbumDetailModal';
import type { DiscogsResult } from '../types';

const BATCH_SIZE = 5;

const SearchBar: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<DiscogsResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);

    const [selectedAlbum, setSelectedAlbum] = useState<AlbumDetails | null>(null);
    const [loadingDetailsId, setLoadingDetailsId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
            setSearchResults(response.data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.response?.data?.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') handleSearch();
    };

    const handleShowMore = () => {
        setVisibleCount(prevCount => prevCount + BATCH_SIZE);
    };


    const handleShowDetails = async (releaseId: number) => {
        setLoadingDetailsId(releaseId);
        try {
            const response = await axios.get<AlbumDetails>(
                `/api/discogs/release/${releaseId}`,
                { withCredentials: true }
            );

            console.log("Données reçues du backend :", response.data); 
            setSelectedAlbum(response.data);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            toast.error("Impossible de récupérer les détails de l'album.");
        } finally {
            setLoadingDetailsId(null);
        }
    };

    const handleCloseModal = () => {
        setSelectedAlbum(null);
    };

    const handleConfirmAddToCollection = async (format: string) => {
        if (!selectedAlbum) return;

        setIsSubmitting(true);
        try {
            await axios.post(
                '/api/collection',
                {
                    discogsId: selectedAlbum.discogsId,
                    title: selectedAlbum.title,
                    artist: selectedAlbum.artist,
                    year: selectedAlbum.year,
                    thumb: selectedAlbum.thumb,
                    cover_image: selectedAlbum.cover_image,
                    format: format,
                },
                { withCredentials: true }
            );
            toast.success(`"${selectedAlbum.title}" a été ajouté à votre collection !`);
            handleCloseModal();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Une erreur est survenue.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-8">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Rechercher un artiste ou un album..."
                    className="flex-grow input input-bordered"
                />
                <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="btn btn-primary"
                >
                    {isLoading ? <span className="loading loading-spinner"></span> : 'Rechercher'}
                </button>
            </div>

            {error && <p className="text-red-500 text-center">{error}</p>}

            <div className="space-y-4">
                {searchResults.slice(0, visibleCount).map((result) => (
                   <AlbumCard
                        key={result.id}
                        result={result}
                        onShowDetails={handleShowDetails}
                        isLoadingDetails={loadingDetailsId === result.id}
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

            <AlbumDetailModal
                album={selectedAlbum}
                onClose={handleCloseModal}
                onConfirm={handleConfirmAddToCollection}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}

export default SearchBar;
