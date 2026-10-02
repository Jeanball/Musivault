import React, { useEffect, useState } from 'react';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { getPreferences } from '../api/preferences';
import { isApiError } from '../api/errors';
import { getRelease } from '../api/discogs';
import {
    getCollectionItem,
    updateCollectionItem,
    syncItemPrice,
    removeFromCollection,
    ignoreFormatAlert,
    restoreFormatAlert
} from '../api/collection';
import { useTranslation } from 'react-i18next';
import { toastService } from '../utils/toast';
import { stripDiscogsSuffix } from '../utils/formatters';
import type { CollectionItem } from '../types/collection.types';
import { getItemValue } from '../utils/itemValue';
import { MEDIA_CONDITIONS, SLEEVE_CONDITIONS } from '../utils/conditions';
import { useCollectionData } from '../hooks/collection/useCollectionData';
import { getImageUrl } from '../utils/imageUrl';
import { getFormatVerificationMessage, hasActiveFormatVerificationIssue, hasIgnoredFormatVerificationIssue } from '../utils/formatVerification';
import { SpotifyIcon, DiscogsIcon } from '../components/Common/BrandIcons';
import FormatVerificationBadge from '../components/Common/FormatVerificationBadge';
import FormatColorBadge from '../components/Common/FormatColorBadge';
import CustomFieldsEditor from '../components/Common/CustomFieldsEditor';
import LabelLink from '../components/Common/LabelLink';
import FieldRow from '../components/Common/FieldRow';
import BackButton from '../components/Common/BackButton';
import { useCurrency } from '../hooks/useCurrency';

interface AlbumDetailLocationState {
    backTo?: string;
}

const AlbumDetailPage: React.FC = () => {
    const { itemId } = useParams<{ itemId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { refreshCollection } = useCollectionData();
    const [item, setItem] = useState<CollectionItem | null>(null);
    const [spotifyUrl, setSpotifyUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [conditionGradingEnabled, setConditionGradingEnabled] = useState(false);
    const [isSyncingPrice, setIsSyncingPrice] = useState(false);
    const [isOpeningRematch, setIsOpeningRematch] = useState(false);
    const [isIgnoringFormatAlert, setIsIgnoringFormatAlert] = useState(false);
    const [isRestoringFormatAlert, setIsRestoringFormatAlert] = useState(false);
    const { formatValue } = useCurrency();
    const backTarget = (location.state as AlbumDetailLocationState | null)?.backTo || '/app/collection';

    useEffect(() => {
        if (itemId) {
            fetchData(itemId);
        }
    }, [itemId]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [itemId]);

    useEffect(() => {
        if (item) {
            searchSpotify(item.album.artist, item.album.title);
            setLoading(false);
        }
    }, [item]);

    const fetchData = async (id: string) => {
        try {
            const [itemRes, prefs] = await Promise.all([
                getCollectionItem(id),
                getPreferences()
            ]);
            setItem(itemRes);
            setConditionGradingEnabled(prefs.enableConditionGrading || false);
        } catch (error) {
            console.error('Failed to fetch collection item:', error);
            setLoading(false);
        }
    };

    const updateCondition = async (field: 'mediaCondition' | 'sleeveCondition', value: string | null) => {
        if (!item) return;
        try {
            await updateCollectionItem(item._id, { [field]: value });
            setItem(prev => prev ? { ...prev, [field]: value } : null);
            toastService.success(t('condition.updated'));
        } catch (error) {
            console.error('Failed to update condition:', error);
            toastService.error(t('settings.failedUpdateSetting'));
        }
    };

    const syncPrice = async () => {
        if (!item) return;
        setIsSyncingPrice(true);
        try {
            const updated = await syncItemPrice(item._id);
            setItem({ ...item, priceCache: updated.priceCache });
            toastService.success(t('album.priceUpdated'));
        } catch (error) {
            console.error('Failed to sync price:', error);
            if (isApiError(error) && error.status === 404) {
               toastService.error(t('album.priceUnavailable'));
            } else {
               toastService.error(t('album.failedSyncPrice'));
            }
        } finally {
            setIsSyncingPrice(false);
        }
    };

    const searchSpotify = (artist: string, album: string) => {
        const query = encodeURIComponent(`${artist} ${album}`);
        setSpotifyUrl(`https://open.spotify.com/search/${query}`);
    };

    const handleDelete = async () => {
        if (!confirm(t('album.confirmDelete'))) {
            return;
        }

        try {
            await removeFromCollection(item!._id);
            toastService.success(t('album.removed'));
            navigate('/app');
        } catch (error) {
            console.error('Failed to delete album:', error);
            toastService.error(t('album.failedRemove'));
        }
    };

    const handleOpenRematchVersions = async () => {
        if (!item?.album.discogsId) {
            toastService.error(t('rematch.noMainRelease'));
            return;
        }

        setIsOpeningRematch(true);
        try {
            const release = await getRelease(item.album.discogsId);

            const masterId = release.master_id;

            if (masterId) {
                navigate(`/app/master/${masterId}?rematchItemId=${item._id}&format=${encodeURIComponent(item.format.name)}`);
                return;
            }

            navigate(`/app/release/${item.album.discogsId}`);
        } catch (error) {
            console.error('Failed to open rematch versions:', error);
            toastService.error(t('versions.errorLoadingVersions'));
        } finally {
            setIsOpeningRematch(false);
        }
    };

    const handleBack = () => {
        navigate(backTarget, {
            state: { restoreCollectionScroll: backTarget === '/app/collection' }
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="p-8">
                <div className="alert alert-error">
                    <span>{t('album.notFound')}</span>
                </div>
            </div>
        );
    }

    // Get data from MongoDB (item.album)
    const album = item.album;
    const tracklist = album.tracklist || [];
    const labels = album.labels || [];
    const genres = album.styles || [];
    const hasActiveFormatIssue = hasActiveFormatVerificationIssue(item.formatVerification);
    const hasIgnoredFormatIssue = hasIgnoredFormatVerificationIssue(item.formatVerification);

    const handleIgnoreFormatAlert = async () => {
        if (!item || !hasActiveFormatIssue) {
            return;
        }

        setIsIgnoringFormatAlert(true);
        try {
            setItem(await ignoreFormatAlert(item._id));
            await refreshCollection();
            toastService.success(t('formatVerification.ignoreSuccess'));
        } catch (error) {
            console.error('Failed to ignore format alert:', error);
            toastService.error(t('formatVerification.ignoreError'));
        } finally {
            setIsIgnoringFormatAlert(false);
        }
    };

    const handleRestoreFormatAlert = async () => {
        if (!item || !hasIgnoredFormatIssue) {
            return;
        }

        setIsRestoringFormatAlert(true);
        try {
            setItem(await restoreFormatAlert(item._id));
            await refreshCollection();
            toastService.success(t('formatVerification.undoSuccess'));
        } catch (error) {
            console.error('Failed to restore format alert:', error);
            toastService.error(t('formatVerification.undoError'));
        } finally {
            setIsRestoringFormatAlert(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4">
            <BackButton onClick={handleBack} />

            {/* Dossier */}
            <div className="flex flex-col lg:flex-row gap-8 sm:border sm:border-base-300 sm:p-6">
                {/* Cover column */}
                <div className="shrink-0 lg:w-60 flex flex-col gap-4">
                    <img
                        src={getImageUrl(album.cover_image || '/placeholder-album.svg')}
                        alt={album.title}
                        className="w-full aspect-square object-cover border border-base-300"
                    />

                    <div className="flex gap-2">
                        {spotifyUrl && (
                            <a
                                href={spotifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm flex-1 btn-spotify"
                                aria-label={t('album.listenOnSpotify')}
                            >
                                <SpotifyIcon className="w-3.5 h-3.5" />
                                Spotify
                            </a>
                        )}
                        {album.discogsId && (
                            <a
                                href={`https://www.discogs.com/release/${album.discogsId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm flex-1 btn-discogs"
                                aria-label={t('album.viewOnDiscogs')}
                            >
                                <DiscogsIcon className="w-3.5 h-3.5" />
                                Discogs
                            </a>
                        )}
                    </div>

                    {conditionGradingEnabled && (
                        <div className="flex gap-2">
                            <div className="flex-1 min-w-0 flex flex-col">
                                <label className="block text-[0.65rem] font-semibold uppercase tracking-wide text-base-content/60 mb-0.5 leading-tight min-h-[1.7rem]">
                                    {t('condition.media')}
                                </label>
                                <select
                                    className="select select-sm w-full"
                                    value={item.mediaCondition || ''}
                                    onChange={(e) => updateCondition('mediaCondition', e.target.value || null)}
                                >
                                    <option value="">{t('condition.grades.none')}</option>
                                    {MEDIA_CONDITIONS.map((cond) => (
                                        <option key={cond.value} value={cond.value}>
                                            {t(cond.labelKey)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                                <label className="block text-[0.65rem] font-semibold uppercase tracking-wide text-base-content/60 mb-0.5 leading-tight min-h-[1.7rem]">
                                    {t('condition.sleeve')}
                                </label>
                                <select
                                    className="select select-sm w-full"
                                    value={item.sleeveCondition || ''}
                                    onChange={(e) => updateCondition('sleeveCondition', e.target.value || null)}
                                >
                                    <option value="">{t('condition.grades.none')}</option>
                                    {SLEEVE_CONDITIONS.map((cond) => (
                                        <option key={cond.value} value={cond.value}>
                                            {t(cond.labelKey)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Info column */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">{item.format.name}</span>
                        <FormatVerificationBadge verification={item.formatVerification} />
                    </div>
                    {hasIgnoredFormatIssue && (
                        <div className="flex items-center gap-2 text-xs text-base-content/60 mb-2">
                            <span>{t('formatVerification.ignoredLabel')}</span>
                            <button
                                onClick={handleRestoreFormatAlert}
                                className={`btn btn-ghost btn-xs min-h-0 h-auto px-1 normal-case ${isRestoringFormatAlert ? 'loading' : ''}`}
                                disabled={isRestoringFormatAlert}
                            >
                                {t('formatVerification.undoAction')}
                            </button>
                        </div>
                    )}

                    <h1 className="text-4xl md:text-5xl font-bold mb-2">{album.title}</h1>
                    <h2 className="text-2xl md:text-3xl text-base-content/70 mb-3">{stripDiscogsSuffix(album.artist)}</h2>

                    {(item.format.text || (item.format.descriptions && item.format.descriptions.length > 0)) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {item.format.text && (
                                <FormatColorBadge text={item.format.text} className="badge-lg min-h-6 py-1" />
                            )}
                            {item.format.descriptions?.map((desc, index) => (
                                <FormatColorBadge key={index} text={desc} className="badge-lg min-h-6 py-1" />
                            ))}
                        </div>
                    )}

                    {hasActiveFormatIssue && item.formatVerification && (
                        <div className={`alert mb-4 items-start ${item.formatVerification.status === 'mismatch' ? 'alert-error' : 'alert-warning'}`}>
                            <CircleAlert size={18} className="mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <p>{getFormatVerificationMessage(item.formatVerification, t)}</p>
                                <div className="mt-3">
                                    <button
                                        onClick={handleIgnoreFormatAlert}
                                        className={`btn btn-sm btn-outline bg-base-100 ${isIgnoringFormatAlert ? 'loading' : ''}`}
                                        disabled={isIgnoringFormatAlert}
                                    >
                                        {t('formatVerification.ignoreAction')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mb-5">
                        {labels.length > 0 && (
                            <FieldRow label={t('album.label')}>
                                <LabelLink label={labels[0]} />
                                {labels[0].catno && labels[0].catno !== 'none' && (
                                    <span className="text-base-content/50">· {labels[0].catno}</span>
                                )}
                            </FieldRow>
                        )}
                        <FieldRow label={t('common.year')}>{album.year || '—'}</FieldRow>
                        {genres.length > 0 && (
                            <FieldRow label={t('album.genres')}>{genres.join(' · ')}</FieldRow>
                        )}
                        <CustomFieldsEditor
                            itemId={item._id}
                            values={item.customFields}
                            onUpdate={(customFields) => setItem((prev) => (prev ? { ...prev, customFields } : null))}
                        />
                        <FieldRow label={t('collection.added')}>
                            {new Date(item.addedAt).toLocaleDateString()}
                        </FieldRow>
                        {(() => {
                            const val = getItemValue(item);
                            const conditionLabel = item.mediaCondition || 'VG+';
                            const lastUpdated = item.priceCache?.updatedAt
                                ? new Date(item.priceCache.updatedAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : null;

                            return (
                                <FieldRow label={t('stats.value')}>
                                    <span className={`font-mono text-xl font-bold tabular-nums ${val > 0 ? '' : 'text-base-content/30'}`}>
                                        {val > 0 ? formatValue(val) : 'N/A'}
                                    </span>
                                    <button
                                        onClick={syncPrice}
                                        disabled={isSyncingPrice}
                                        className="btn btn-ghost btn-xs btn-circle tooltip tooltip-top"
                                        data-tip={t('album.syncPrice')}
                                    >
                                        <RefreshCw size={13} className={isSyncingPrice ? 'animate-spin' : ''} />
                                    </button>
                                    <span className="text-xs text-base-content/50">
                                        {conditionLabel} {lastUpdated && <span className="opacity-70">· {lastUpdated}</span>}
                                    </span>
                                </FieldRow>
                            );
                        })()}
                    </div>

                    {tracklist.length > 0 && (
                        <div className="mb-5">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-1">
                                {t('album.tracklist')}{' '}
                                <span className="normal-case font-normal">({tracklist.length})</span>
                            </h3>
                            <div className="border-t border-base-300 sm:columns-2 sm:gap-x-8">
                                {tracklist.map((track, index) => {
                                    const fullTitle = track.artist ? `${track.title} — ${track.artist}` : track.title;
                                    return (
                                        <div key={index} className="flex items-baseline gap-2 py-1.5 border-b border-base-300 text-sm break-inside-avoid">
                                            <span className="font-mono text-xs text-base-content/50 w-6 shrink-0">{track.position}</span>
                                            <span className="flex-1 min-w-0 truncate" title={fullTitle}>{fullTitle}</span>
                                            <span className="font-mono tabular-nums text-xs text-base-content/50 shrink-0">{track.duration || '—'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleOpenRematchVersions}
                            className={`btn btn-warning btn-outline ${isOpeningRematch ? 'loading' : ''}`}
                            title={t('album.rematch')}
                            disabled={isOpeningRematch}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t('album.rematch')}
                        </button>
                        <button onClick={handleDelete} className="btn btn-error btn-outline" title="Remove from collection">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {t('common.delete')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AlbumDetailPage;
