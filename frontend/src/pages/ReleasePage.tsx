import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getRelease } from '../api/discogs';
import { addToCollection as apiAddToCollection } from '../api/collection';
import { isApiError, isRateLimitError } from '../api/errors';
import { getPreferences } from '../api/preferences';
import { useTranslation } from 'react-i18next';
import { toastService } from '../utils/toast';
import { stripArtistSuffix } from '../utils/formatters';
import { type AlbumDetails, type FormatDetails } from '../types/album.types';
import ConditionModal from '../components/Modal/ConditionModal';
import ConfirmAddModal from '../components/Modal/ConfirmAddModal';
import BackButton from '../components/Common/BackButton';
import PageLoadError from '../components/Common/PageLoadError';
import { getImageUrl } from '../utils/imageUrl';
import { getFormatButtonStyle } from '../utils/formatColors';

interface AddedAlbumInfo {
    id: string;
    title: string;
}

const ReleasePage: React.FC = () => {
    const { releaseId } = useParams<{ releaseId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [albumDetails, setAlbumDetails] = useState<AlbumDetails | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    /** Bumped by the retry button to re-run the fetch effect. */
    const [retryCount, setRetryCount] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [addedAlbum, setAddedAlbum] = useState<AddedAlbumInfo | null>(null);

    // Condition grading state
    const [conditionGradingEnabled, setConditionGradingEnabled] = useState<boolean>(false);
    const [showConditionModal, setShowConditionModal] = useState<boolean>(false);
    const [pendingFormat, setPendingFormat] = useState<FormatDetails | null>(null);

    // Confirmation modal state
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    const [confirmFormat, setConfirmFormat] = useState<FormatDetails | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!releaseId) return;
            setIsLoading(true);
            setLoadError(null);
            try {
                // Fetch release details and user preferences in parallel
                const [release, prefs] = await Promise.all([
                    getRelease(releaseId),
                    getPreferences()
                ]);
                setAlbumDetails(release);
                setConditionGradingEnabled(prefs.enableConditionGrading || false);
            } catch (error) {
                console.error('Error loading release details:', error);
                setLoadError(error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [releaseId, retryCount]);

    const handleFormatClick = (format: FormatDetails) => {
        setConfirmFormat(format);
        setShowConfirmModal(true);
    };

    const handleConfirmAdd = () => {
        setShowConfirmModal(false);
        if (!confirmFormat) return;

        if (conditionGradingEnabled) {
            setPendingFormat(confirmFormat);
            setShowConditionModal(true);
        } else {
            addToCollection(confirmFormat, null, null);
        }
        setConfirmFormat(null);
    };

    const handleConfirmCancel = () => {
        setShowConfirmModal(false);
        setConfirmFormat(null);
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
            const { item } = await apiAddToCollection({
                ...albumDetails,
                format,
                mediaCondition,
                sleeveCondition
            });
            toastService.success(t('common.addedSuccess', { title: albumDetails.title }));
            setAddedAlbum({
                id: item._id,
                title: albumDetails.title
            });
            setPendingFormat(null);
        } catch (err) {
            const message = isApiError(err) ? err.serverMessage : undefined;
            toastService.error(message || t('common.error'));
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

    if (loadError) {
        return (
            <PageLoadError
                isRateLimited={isRateLimitError(loadError)}
                message={t('release.errorLoading')}
                onRetry={() => setRetryCount(c => c + 1)}
            />
        );
    }

    if (!albumDetails) {
        return <div className="text-center p-8">{t('release.noData')}</div>;
    }

    const formats = albumDetails.availableFormats || [];

    return (
        <div className="p-4 md:p-8">
            <BackButton className="max-w-4xl mx-auto" />

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

                    {/* Format selection - direct click to add */}
                    {formats.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-gray-400 mb-3">{t('versions.selectFormat')}</h3>
                            <div className="flex flex-col gap-2">
                                {formats.map((format, index) => (
                                    <button
                                        key={index}
                                        className="btn border border-base-300 bg-transparent hover:border-primary/50 hover:bg-transparent h-auto py-3 normal-case justify-start max-w-full relative overflow-hidden group"
                                        onClick={() => handleFormatClick(format)}
                                        disabled={isSubmitting}
                                        style={getFormatButtonStyle(format.text, format.descriptions)}
                                    >
                                        <div className="absolute inset-0 bg-base-content opacity-0 group-hover:opacity-[0.08] transition-opacity pointer-events-none"></div>
                                        <div className="text-left w-full break-words whitespace-normal overflow-hidden relative z-10 flex flex-col justify-center gap-0.5">
                                            <div className="font-bold text-lg leading-tight">
                                                {format.name}
                                                {format.text && <span className="ml-2 break-words">{format.text}</span>}
                                            </div>
                                            <div className="text-xs font-normal opacity-80 mt-1 break-words min-h-[1rem]">
                                                {format.descriptions?.length > 0 ? format.descriptions.join(', ') : '\u00A0'}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmAddModal
                isOpen={showConfirmModal}
                coverImage={albumDetails.cover_image}
                albumTitle={albumDetails.title}
                format={confirmFormat}
                onConfirm={handleConfirmAdd}
                onCancel={handleConfirmCancel}
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
