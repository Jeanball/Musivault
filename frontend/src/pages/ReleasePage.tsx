import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toastService } from '../utils/toast';
import { stripArtistSuffix } from '../utils/formatters';
import AlbumDetailModal, { type AlbumDetails, type FormatDetails } from '../components/Modal/AddAlbumVersionModal';
import ConditionModal from '../components/Modal/ConditionModal';
import { getImageUrl } from '../utils/imageUrl';

interface AddedAlbumInfo {
    id: string;
    title: string;
}

interface PreferencesResponse {
    enableConditionGrading: boolean;
}

const ReleasePage: React.FC = () => {
    const { releaseId } = useParams<{ releaseId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [albumDetails, setAlbumDetails] = useState<AlbumDetails | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [addedAlbum, setAddedAlbum] = useState<AddedAlbumInfo | null>(null);

    // Condition grading state
    const [conditionGradingEnabled, setConditionGradingEnabled] = useState<boolean>(false);
    const [showConditionModal, setShowConditionModal] = useState<boolean>(false);
    const [pendingFormat, setPendingFormat] = useState<FormatDetails | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!releaseId) return;
            try {
                // Fetch release details and user preferences in parallel
                const [releaseRes, prefsRes] = await Promise.all([
                    axios.get<AlbumDetails>(`/api/discogs/release/${releaseId}`, { withCredentials: true }),
                    axios.get<PreferencesResponse>('/api/users/preferences', { withCredentials: true })
                ]);
                setAlbumDetails(releaseRes.data);
                setConditionGradingEnabled(prefsRes.data.enableConditionGrading || false);
            } catch (error) {
                console.log("Error loading release details:", error);
                toastService.error(t('release.errorLoading'));
                navigate('/app');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [releaseId, navigate, t]);

    const handleFormatSelected = (format: FormatDetails) => {
        setShowModal(false);

        if (conditionGradingEnabled) {
            // Show condition modal before adding
            setPendingFormat(format);
            setShowConditionModal(true);
        } else {
            // Add directly without conditions
            addToCollection(format, null, null);
        }
    };

    const handleConditionConfirm = (mediaCondition: string | null, sleeveCondition: string | null) => {
        setShowConditionModal(false);
        if (pendingFormat) {
            addToCollection(pendingFormat, mediaCondition, sleeveCondition);
        }
    };

    const handleConditionSkip = () => {
        setShowConditionModal(false);
        if (pendingFormat) {
            addToCollection(pendingFormat, null, null);
        }
    };

    const addToCollection = async (
        format: FormatDetails,
        mediaCondition: string | null,
        sleeveCondition: string | null
    ) => {
        if (!albumDetails) return;
        setIsSubmitting(true);
        try {
            const response = await axios.post('/api/collection', {
                ...albumDetails,
                format,
                mediaCondition,
                sleeveCondition
            }, { withCredentials: true });
            toastService.success(t('common.addedSuccess', { title: albumDetails.title }));
            setAddedAlbum({
                id: response.data.item._id,
                title: albumDetails.title
            });
            setPendingFormat(null);
        } catch (err: any) {
            toastService.error(err.response?.data?.message || t('common.error'));
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
        return <div className="text-center p-8">{t('release.noData')}</div>;
    }

    return (
        <div className="p-4 md:p-8">
            <div className="flex flex-col md:flex-row gap-8 max-w-4xl mx-auto">

                {/* Cover Image */}
                <div className="md:w-1/3 lg:w-1/4 flex-shrink-0">
                    {albumDetails.cover_image && (
                        <img
                            src={getImageUrl(albumDetails.cover_image)}
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
                            <h3 className="text-sm font-semibold text-gray-400 mb-2">{t('common.formats')}:</h3>
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
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? <span className="loading loading-spinner"></span> : t('addAlbum.addToCollection')}
                        </button>
                        <button onClick={() => navigate(-1)} className="btn btn-outline gap-2">
                            <ArrowLeft size={16} /> {t('common.back')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal for format selection */}
            <AlbumDetailModal
                album={showModal ? albumDetails : null}
                onClose={() => setShowModal(false)}
                onConfirm={handleFormatSelected}
                isSubmitting={isSubmitting}
            />

            {/* Condition Modal */}
            <ConditionModal
                isOpen={showConditionModal}
                albumTitle={albumDetails.title}
                onSkip={handleConditionSkip}
                onConfirm={handleConditionConfirm}
            />

            {/* Success Modal - Choice after adding */}
            {addedAlbum && (
                <dialog className="modal modal-open">
                    <div className="modal-box text-center">
                        <div className="text-5xl mb-4">🎉</div>
                        <h3 className="font-bold text-xl mb-2">{t('common.albumAdded')}</h3>
                        <p className="text-base-content/70 mb-6">
                            {t('common.addedSuccess', { title: addedAlbum.title })}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                className="btn btn-primary"
                                onClick={handleGoToAlbum}
                            >
                                {t('common.viewAlbum')}
                            </button>
                            <button
                                className="btn btn-outline"
                                onClick={handleContinueSearching}
                            >
                                {t('common.continueSearching')}
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

