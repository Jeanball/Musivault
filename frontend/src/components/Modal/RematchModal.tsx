import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AlbumCard from '../AlbumCard';
import type { DiscogsResult } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import { toastService } from '../../utils/toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface RematchModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: string;
    currentArtist: string;
    currentTitle: string;
    onRematchSuccess: () => void;
}

const RematchModal: React.FC<RematchModalProps> = ({
    isOpen,
    onClose,
    itemId,
    currentArtist,
    currentTitle,
    onRematchSuccess
}) => {
    const [searchQuery, setSearchQuery] = useState<string>(`${currentArtist} ${currentTitle}`);
    const [results, setResults] = useState<DiscogsResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isRematching, setIsRematching] = useState<boolean>(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery(`${currentArtist} ${currentTitle}`);
            setSelectedId(null);
        }
    }, [isOpen, currentArtist, currentTitle]);

    useEffect(() => {
        if (debouncedSearchQuery.length > 2) {
            setIsLoading(true);
            const search = async () => {
                try {
                    const response = await axios.get<DiscogsResult[]>(`${API_BASE_URL}/api/discogs/search`, {
                        params: { q: debouncedSearchQuery },
                        withCredentials: true
                    });
                    setResults(Array.isArray(response.data) ? response.data : []);
                } catch (err) {
                    console.error('Search failed:', err);
                    toastService.error('Search failed');
                    setResults([]);
                } finally {
                    setIsLoading(false);
                }
            };
            search();
        } else {
            setResults([]);
        }
    }, [debouncedSearchQuery]);

    const handleSelectAlbum = async (result: DiscogsResult) => {
        // For masters, we need to get the main release ID
        let releaseId = result.id;

        if (result.type === 'master') {
            try {
                setIsRematching(true);
                setSelectedId(result.id);
                // Fetch master details to get main_release
                const masterResponse = await axios.get(`${API_BASE_URL}/api/discogs/master/${result.id}/versions`, {
                    withCredentials: true
                });
                releaseId = masterResponse.data.main_release || result.id;
            } catch (err) {
                console.error('Failed to fetch master details:', err);
                // Fall back to using the master ID directly
            }
        }

        setIsRematching(true);
        setSelectedId(result.id);

        try {
            await axios.post(
                `${API_BASE_URL}/api/collection/${itemId}/rematch`,
                { newDiscogsId: releaseId },
                { withCredentials: true }
            );
            toastService.success('Album rematched successfully!');
            onRematchSuccess();
            onClose();
        } catch (err: any) {
            console.error('Rematch failed:', err);
            toastService.error(err.response?.data?.message || 'Failed to rematch album');
        } finally {
            setIsRematching(false);
            setSelectedId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <dialog className="modal modal-open" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-box max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Rematch Album</h3>
                    <button
                        onClick={onClose}
                        className="btn btn-sm btn-circle btn-ghost"
                        disabled={isRematching}
                    >
                        ✕
                    </button>
                </div>

                {/* Search Input */}
                <div className="relative mb-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for the correct album..."
                        className="input input-bordered w-full pr-10"
                        disabled={isRematching}
                    />
                    {isLoading && (
                        <span className="loading loading-spinner loading-sm absolute top-1/2 right-3 -translate-y-1/2"></span>
                    )}
                </div>

                {/* Info */}
                <p className="text-sm text-base-content/60 mb-4">
                    Click on an album to select it as the new match
                </p>

                {/* Results */}
                <div className="overflow-y-auto flex-1 space-y-3">
                    {results.map((result) => (
                        <div
                            key={result.id}
                            className={`relative ${selectedId === result.id ? 'opacity-50' : ''}`}
                        >
                            <AlbumCard
                                result={result}
                                onShowDetails={() => handleSelectAlbum(result)}
                                isLoadingDetails={selectedId === result.id && isRematching}
                            />
                            {selectedId === result.id && isRematching && (
                                <div className="absolute inset-0 flex items-center justify-center bg-base-300/50 rounded-lg">
                                    <span className="loading loading-spinner loading-md"></span>
                                </div>
                            )}
                        </div>
                    ))}

                    {!isLoading && results.length === 0 && debouncedSearchQuery.length > 2 && (
                        <div className="text-center py-8 text-base-content/60">
                            No results found
                        </div>
                    )}

                    {!isLoading && debouncedSearchQuery.length <= 2 && (
                        <div className="text-center py-8 text-base-content/60">
                            Type at least 3 characters to search
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-action mt-4">
                    <button onClick={onClose} className="btn btn-ghost" disabled={isRematching}>
                        Cancel
                    </button>
                </div>
            </div>
        </dialog>
    );
};

export default RematchModal;
