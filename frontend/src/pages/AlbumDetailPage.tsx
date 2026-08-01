import React, { useEffect, useState } from 'react';
import { ArrowLeft, CircleAlert, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';
import axios from 'axios';
import { getPreferences } from '../api/preferences';
import { useTranslation } from 'react-i18next';
import { toastService } from '../utils/toast';
import { stripArtistSuffix } from '../utils/formatters';
import type { CollectionItem } from '../types/collection.types';
import { getItemValue } from '../utils/itemValue';
import type { AlbumDetails } from '../types/album.types';
import { MEDIA_CONDITIONS, SLEEVE_CONDITIONS } from '../utils/conditions';
import { useCollectionData } from '../hooks/collection/useCollectionData';
import { getImageUrl } from '../utils/imageUrl';
import { getFormatVerificationMessage, hasActiveFormatVerificationIssue, hasIgnoredFormatVerificationIssue } from '../utils/formatVerification';
import { SPOTIFY_BUTTON_STYLE, DISCOGS_BUTTON_STYLE } from '../utils/brandColors';
import FormatVerificationBadge from '../components/Common/FormatVerificationBadge';
import FormatColorBadge from '../components/Common/FormatColorBadge';
import CustomFieldsEditor from '../components/Common/CustomFieldsEditor';
import FieldRow from '../components/Common/FieldRow';
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
                axios.get(`/api/collection/${id}`, { withCredentials: true }),
                getPreferences()
            ]);
            setItem(itemRes.data);
            setConditionGradingEnabled(prefs.enableConditionGrading || false);
        } catch (error) {
            console.error('Failed to fetch collection item:', error);
            setLoading(false);
        }
    };

    const updateCondition = async (field: 'mediaCondition' | 'sleeveCondition', value: string | null) => {
        if (!item) return;
        try {
            await axios.put(`/api/collection/${item._id}`, {
                [field]: value
            }, { withCredentials: true });
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
            const res = await axios.post(`/api/collection/${item._id}/sync-price`, {}, { withCredentials: true });
            setItem({ ...item, priceCache: res.data.priceCache });
            toastService.success(t('album.priceUpdated'));
        } catch (error: any) {
            console.error('Failed to sync price:', error);
            if (error.response?.status === 404) {
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
            await axios.delete(`/api/collection/${item?._id}`, { withCredentials: true });
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
            const response = await axios.get<AlbumDetails>(`/api/discogs/release/${item.album.discogsId}`, {
                withCredentials: true
            });

            const masterId = response.data.master_id;

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
            const response = await axios.post<CollectionItem>(
                `/api/collection/${item._id}/ignore-format-alert`,
                {},
                { withCredentials: true }
            );
            setItem(response.data);
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
            const response = await axios.post<CollectionItem>(
                `/api/collection/${item._id}/restore-format-alert`,
                {},
                { withCredentials: true }
            );
            setItem(response.data);
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
            {/* Header Actions */}
            <div className="flex justify-start items-center mb-6">
                <button onClick={handleBack} className="btn btn-ghost btn-sm gap-2">
                    <ArrowLeft size={16} /> {t('common.back')}
                </button>
            </div>

            {/* Dossier */}
            <div className="flex flex-col lg:flex-row gap-8 sm:border sm:border-base-300 sm:p-6">
                {/* Cover column */}
                <div className="flex-shrink-0 lg:w-60 flex flex-col gap-4">
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
                                className="btn btn-sm flex-1"
                                style={SPOTIFY_BUTTON_STYLE}
                                aria-label={t('album.listenOnSpotify')}
                            >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                </svg>
                                Spotify
                            </a>
                        )}
                        {album.discogsId && (
                            <a
                                href={`https://www.discogs.com/release/${album.discogsId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm flex-1"
                                style={DISCOGS_BUTTON_STYLE}
                                aria-label={t('album.viewOnDiscogs')}
                            >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M1.7422 11.982c0-5.6682 4.61-10.2782 10.2758-10.2782 1.8238 0 3.5372.48 5.0251 1.3175l.8135-1.4879C16.1768.588 14.2474.036 12.1908.0024h-.1944C5.4091.0144.072 5.3107 0 11.886v.1152c.0072 3.4389 1.4567 6.5345 3.7748 8.7207l1.1855-1.2814c-1.9798-1.8743-3.218-4.526-3.218-7.4585zM20.362 3.4053l-1.1543 1.2406c1.903 1.867 3.0885 4.4636 3.0885 7.3361 0 5.6658-4.61 10.2758-10.2758 10.2758-1.783 0-3.4605-.456-4.922-1.2575l-.8542 1.5214c1.7086.9384 3.6692 1.4735 5.7546 1.4759C18.6245 23.9976 24 18.6246 24 11.9988c-.0048-3.3717-1.399-6.4146-3.638-8.5935zM1.963 11.982c0 2.8701 1.2119 5.4619 3.146 7.2953l1.1808-1.2767c-1.591-1.5166-2.587-3.6524-2.587-6.0186 0-4.586 3.7293-8.3152 8.3152-8.3152 1.483 0 2.875.3912 4.082 1.0751l.8351-1.5262C15.481 2.395 13.8034 1.927 12.018 1.927 6.4746 1.9246 1.963 6.4362 1.963 11.982zm18.3702 0c0 4.586-3.7293 8.3152-8.3152 8.3152-1.4327 0-2.7837-.3648-3.962-1.0055l-.852 1.5166c1.4303.7823 3.0718 1.2287 4.814 1.2287 5.5434 0 10.055-4.5116 10.055-10.055 0-2.8077-1.1567-5.3467-3.0165-7.1729l-1.183 1.2743c1.519 1.507 2.4597 3.5924 2.4597 5.8986zm-1.9486 0c0 3.5109-2.8558 6.3642-6.3642 6.3642a6.3286 6.3286 0 01-3.0069-.756l-.8471 1.507c1.147.624 2.4597.9768 3.854.9768 4.4636 0 8.0944-3.6308 8.0944-8.0944 0-2.239-.9143-4.2692-2.3902-5.7378l-1.1783 1.267c1.1351 1.152 1.8383 2.731 1.8383 4.4732zm-14.4586 0c0 2.3014.9671 4.382 2.515 5.8578l1.1734-1.2695c-1.207-1.159-1.9606-2.786-1.9606-4.5883 0-3.5108 2.8557-6.3642 6.3642-6.3642 1.1423 0 2.215.3048 3.1437.8352l.8303-1.5167c-1.1759-.6647-2.5317-1.0487-3.974-1.0487-4.4612 0-8.092 3.6308-8.092 8.0944zm12.5292 0c0 2.4502-1.987 4.4372-4.4372 4.4372a4.4192 4.4192 0 01-2.0614-.5088l-.8351 1.4879a6.1135 6.1135 0 002.8965.727c3.3885 0 6.1434-2.7548 6.1434-6.1433 0-1.6774-.6767-3.1989-1.7686-4.3076l-1.1615 1.2503c.7559.7967 1.2239 1.8718 1.2239 3.0573zm-10.5806 0c0 1.7374.7247 3.3069 1.8886 4.4252L8.92 15.1569l.0144.0144c-.8351-.8063-1.3559-1.9366-1.3559-3.1869 0-2.4502 1.9846-4.4372 4.4372-4.4372.8087 0 1.5646.2184 2.2174.5976l.8207-1.4975a6.097 6.097 0 00-3.0381-.8063c-3.3837-.0048-6.141 2.7525-6.141 6.141zm6.681 0c0 .2952-.2424.5351-.5376.5351-.2952 0-.5375-.24-.5375-.5351 0-.2976.24-.5375.5375-.5375.2952 0 .5375.24.5375.5375zm-3.9405 0c0-1.879 1.5239-3.4029 3.4005-3.4029 1.879 0 3.4005 1.5215 3.4005 3.4029 0 1.879-1.5239 3.4005-3.4005 3.4005S8.6151 13.861 8.6151 11.982zm.1488 0c.0048 1.7974 1.4567 3.2493 3.2517 3.2517 1.795 0 3.254-1.4567 3.254-3.2517-.0023-1.7974-1.4566-3.2517-3.254-3.254-1.795 0-3.2517 1.4566-3.2517 3.254Z" />
                                </svg>
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
                                    className="select select-bordered select-sm w-full"
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
                                    className="select select-bordered select-sm w-full"
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
                    <h2 className="text-2xl md:text-3xl text-base-content/70 mb-3">{stripArtistSuffix(album.artist)}</h2>

                    {(item.format.text || (item.format.descriptions && item.format.descriptions.length > 0)) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {item.format.text && (
                                <FormatColorBadge text={item.format.text} className="badge-accent badge-lg min-h-6 py-1" />
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
                            <FieldRow label={t('album.label')}>{labels[0].name}</FieldRow>
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
                                    <span className={`font-mono text-xl font-bold tabular-nums ${val > 0 ? 'text-warning' : 'text-base-content/30'}`}>
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
