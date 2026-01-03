/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import axios from 'axios';
import { toastService } from '../utils/toast';
import { stripArtistSuffix } from '../utils/formatters';
import AlbumDetailModal, { type AlbumDetails } from '../components/Modal/AddAlbumVersionModal';

interface AddedAlbumInfo {
    id: string;
    title: string;
}

const ReleasePage: React.FC = () => {
    const { releaseId } = useParams<{ releaseId: string }>();
    const navigate = useNavigate();
    const [albumDetails, setAlbumDetails] = useState<AlbumDetails | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [addedAlbum, setAddedAlbum] = useState<AddedAlbumInfo | null>(null);

    useEffect(() => {
        const fetchReleaseDetails = async () => {
            if (!releaseId) return;
            try {
                const { data } = await axios.get<AlbumDetails>(`/api/discogs/release/${releaseId}`, {
                    withCredentials: true
                });
                setAlbumDetails(data);
            } catch (error) {
                console.log("Error loading release details:", error);
                toastService.error("Error loading release details.");
                navigate('/app');
            } finally {
                setIsLoading(false);
            }
        };
        fetchReleaseDetails();
    }, [releaseId, navigate]);

    const handleConfirmAddToCollection = async (format: any) => {
        if (!albumDetails) return;
        setIsSubmitting(true);
        try {
            const response = await axios.post('/api/collection', { ...albumDetails, format }, { withCredentials: true });
            toastService.success(`"${albumDetails.title}" added to your collection!`);
            setAddedAlbum({
                id: response.data.item._id,
                title: albumDetails.title
            });
            setShowModal(false);
        } catch (err: any) {
            toastService.error(err.response?.data?.message || "An error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoToAlbum = () => {
        if (addedAlbum) {
            navigate(`/app/album/${addedAlbum.id}`);
        }
    };

    const handleContinueSearching = () => {
        setAddedAlbum(null);
        navigate('/app');
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (!albumDetails) {
        return <div className="text-center p-8">No data for this release.</div>;
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col md:flex-row gap-8 max-w-4xl mx-auto">

                {/* Cover Image */}
                <div className="md:w-1/3 lg:w-1/4 flex-shrink-0">
                    {albumDetails.cover_image && (
                        <img
                            src={albumDetails.cover_image}
                            alt={`Cover of ${albumDetails.title}`}
                            className="w-full h-auto object-cover rounded-lg shadow-2xl"
                        />
                    )}
                </div>

                {/* Album Info */}
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">{albumDetails.title}</h1>
                    <p className="text-xl text-gray-400 mt-2">{stripArtistSuffix(albumDetails.artist)}</p>
                    <p className="text-gray-500 mt-1">{albumDetails.year}</p>

                    {/* Available Formats */}
                    {albumDetails.availableFormats && albumDetails.availableFormats.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-sm font-semibold text-gray-400 mb-2">Formats:</h3>
                            <div className="flex flex-wrap gap-2">
                                {albumDetails.availableFormats.map((format, index) => (
                                    <span key={index} className="badge badge-outline">
                                        {format.name}
                                        {format.descriptions?.length > 0 && ` (${format.descriptions.join(', ')})`}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-8 flex gap-4">
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowModal(true)}
                        >
                            Add to Collection
                        </button>
                        <button onClick={() => navigate(-1)} className="btn btn-outline">
                            ← Back
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal for adding to collection */}
            <AlbumDetailModal
                album={showModal ? albumDetails : null}
                onClose={() => setShowModal(false)}
                onConfirm={handleConfirmAddToCollection}
                isSubmitting={isSubmitting}
            />

            {/* Success Modal - Choice after adding */}
            {addedAlbum && (
                <dialog className="modal modal-open">
                    <div className="modal-box text-center">
                        <div className="text-5xl mb-4">🎉</div>
                        <h3 className="font-bold text-xl mb-2">Album Added!</h3>
                        <p className="text-base-content/70 mb-6">
                            "{addedAlbum.title}" has been added to your collection.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                className="btn btn-primary"
                                onClick={handleGoToAlbum}
                            >
                                View Album
                            </button>
                            <button
                                className="btn btn-outline"
                                onClick={handleContinueSearching}
                            >
                                Continue Searching
                            </button>
                        </div>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button onClick={() => setAddedAlbum(null)}>close</button>
                    </form>
                </dialog>
            )}
        </div>
    );
};

export default ReleasePage;
