import React, { useEffect, useState } from 'react';
import { ArrowLeft, CircleAlert, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toastService } from '../utils/toast';
import { stripArtistSuffix } from '../utils/formatters';
import type { CollectionItem } from '../types/collection.types';
import { getItemValue } from '../types/collection.types';
import type { AlbumDetails } from '../components/Modal/AddAlbumVersionModal';
import { MEDIA_CONDITIONS, SLEEVE_CONDITIONS } from '../components/Modal/ConditionModal';
import { getImageUrl } from '../utils/imageUrl';
import { getFormatButtonStyle } from '../utils/formatColors';
import { getFormatVerificationMessage } from '../utils/formatVerification';
import FormatVerificationBadge from '../components/Collection/FormatVerificationBadge';

interface PreferencesResponse {
    enableConditionGrading: boolean;
}

const AlbumDetailPage: React.FC = () => {
    const { itemId } = useParams<{ itemId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [item, setItem] = useState<CollectionItem | null>(null);
    const [spotifyUrl, setSpotifyUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [conditionGradingEnabled, setConditionGradingEnabled] = useState(false);
    const [isSyncingPrice, setIsSyncingPrice] = useState(false);
    const [isOpeningRematch, setIsOpeningRematch] = useState(false);

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
            const [itemRes, prefsRes] = await Promise.all([
                axios.get(`/api/collection/${id}`, { withCredentials: true }),
                axios.get<PreferencesResponse>('/api/users/preferences', { withCredentials: true })
            ]);
            setItem(itemRes.data);
            setConditionGradingEnabled(prefsRes.data.enableConditionGrading || false);
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

    return (
        <div className="max-w-6xl mx-auto p-4">
            {/* Header Actions */}
            <div className="flex justify-start items-center mb-6">
                <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm gap-2">
                    <ArrowLeft size={16} /> {t('common.back')}
                </button>
            </div>

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row gap-8 mb-8">
                {/* Album Cover */}
                <div className="flex-shrink-0">
                    <img
                        src={getImageUrl(album.cover_image || '/placeholder-album.svg')}
                        alt={album.title}
                        className="w-full lg:w-96 h-auto rounded-xl shadow-2xl"
                    />
                </div>

                {/* Album Information */}
                <div className="flex-1">
                    <h1 className="text-4xl md:text-5xl font-bold mb-3">{album.title}</h1>
                    <h2 className="text-2xl md:text-3xl text-base-content/70 mb-2">{stripArtistSuffix(album.artist)}</h2>
                    {labels.length > 0 && (
                        <p className="text-base text-base-content/60 mb-6">
                            <span>{t('album.label')}: </span>
                            <span className="text-base-content">{labels[0].name}</span>
                        </p>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-title">{t('common.year')}</div>
                            <div className="stat-value text-2xl">{album.year || '—'}</div>
                        </div>
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-title flex items-center gap-2">
                                <span>{t('common.format')}</span>
                                <FormatVerificationBadge verification={item.formatVerification} />
                            </div>
                            <div className="stat-value text-2xl flex items-center gap-2">
                                <span>{item.format.name}</span>
                            </div>
                        </div>
                        <div className="stat bg-base-200 rounded-lg p-4">
                            <div className="stat-title">{t('collection.added')}</div>
                            <div className="stat-value text-lg">
                                {new Date(item.addedAt).toLocaleDateString()}
                            </div>
                        </div>
                        {/* Condition selectors - only show when feature is enabled */}
                        {conditionGradingEnabled && (
                            <>
                                <div className="stat bg-base-200 rounded-lg p-4 overflow-hidden">
                                    <div className="stat-title">{t('condition.media')}</div>
                                    <div className="stat-value text-2xl">
                                        <select
                                            className="select select-bordered select-sm bg-base-200 text-base-content font-bold w-full max-w-[130px]"
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
                                </div>
                                <div className="stat bg-base-200 rounded-lg p-4 overflow-hidden">
                                    <div className="stat-title">{t('condition.sleeve')}</div>
                                    <div className="stat-value text-2xl">
                                        <select
                                            className="select select-bordered select-sm bg-base-200 text-base-content font-bold w-full max-w-[130px]"
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
                            </>
                        )}
                        {/* Market Value */}
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
                            
                            if (val <= 0) {
                                return (
                                    <div className="stat bg-base-200 rounded-lg p-4 opacity-70">
                                        <div className="stat-title flex items-center justify-between">
                                            <span>{t('stats.value')}</span>
                                            <button 
                                                onClick={syncPrice} 
                                                disabled={isSyncingPrice}
                                                className="btn btn-ghost btn-xs btn-circle tooltip tooltip-left" 
                                                data-tip={t('album.syncPrice')}
                                            >
                                                <RefreshCw size={14} className={isSyncingPrice ? 'animate-spin' : ''} />
                                            </button>
                                        </div>
                                        <div className="stat-value text-2xl text-base-content/30">
                                            N/A
                                        </div>
                                        <div className="stat-desc">
                                            {conditionLabel} {lastUpdated && <span className="opacity-50 ml-1">• {lastUpdated}</span>}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div className="stat bg-base-200 rounded-lg p-4">
                                    <div className="stat-title flex items-center justify-between">
                                        <span>{t('stats.value')}</span>
                                        <button 
                                            onClick={syncPrice} 
                                            disabled={isSyncingPrice}
                                            className="btn btn-ghost btn-xs btn-circle tooltip tooltip-left" 
                                            data-tip={t('album.syncPrice')}
                                        >
                                            <RefreshCw size={14} className={isSyncingPrice ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                    <div className="stat-value text-2xl text-warning">
                                        {new Intl.NumberFormat(undefined, {
                                            style: 'currency',
                                            currency: item.priceCache?.currency || 'USD',
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0,
                                        }).format(val)}
                                    </div>
                                    <div className="stat-desc">
                                        {conditionLabel} {lastUpdated && <span className="opacity-50 ml-1">• {lastUpdated}</span>}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Genres & Format Details - Side by Side */}
                    <div className="flex flex-wrap gap-8 mb-6">
                        {(album.styles?.length ?? 0) > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-base-content/60 mb-2">{t('album.genres')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {album.styles!.map((style, index) => (
                                        <span key={index} className="badge badge-primary badge-lg">
                                            {style}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {(item.format.text || (item.format.descriptions && item.format.descriptions.length > 0)) && (
                            <div>
                                <h3 className="text-sm font-semibold text-base-content/60 mb-2">{t('album.formatDetails')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {item.format.text && (
                                        <span className="badge badge-accent badge-lg border" style={getFormatButtonStyle(item.format.text, [])}>{item.format.text}</span>
                                    )}
                                    {item.format.descriptions?.map((desc, index) => (
                                        <span key={index} className="badge badge-lg border" style={getFormatButtonStyle(desc, [])}>{desc}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* External Links */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        {spotifyUrl && (
                            <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                </svg>
                                {t('album.listenOnSpotify')}
                            </a>
                        )}
                        {album.discogsId && (
                            <a href={`https://www.discogs.com/release/${album.discogsId}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                                {t('album.viewOnDiscogs')}
                            </a>
                        )}
                    </div>

                    {/* Management Actions */}
                    {item.formatVerification && item.formatVerification.status !== 'match' && (
                        <div className={`alert mb-4 ${item.formatVerification.status === 'mismatch' ? 'alert-error' : 'alert-warning'}`}>
                            <CircleAlert size={18} />
                            <span>
                                {getFormatVerificationMessage(item.formatVerification, t)}
                            </span>
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

            {/* Tracklist Section */}
            {tracklist.length > 0 && (
                <details className="collapse collapse-arrow bg-base-200 shadow-xl mb-8">
                    <summary className="collapse-title text-2xl font-bold">
                        <div className="flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            <span>{t('album.tracklist')} ({t('album.trackCount', { count: tracklist.length })})</span>
                        </div>
                    </summary>
                    <div className="collapse-content">
                        <div className="overflow-x-auto">
                            <table className="table table-zebra">
                                <thead>
                                    <tr>
                                        <th className="w-20">#</th>
                                        <th>{t('common.title')}</th>
                                        <th className="w-32 text-right">{t('album.duration')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tracklist.map((track, index) => (
                                        <tr key={index} className="hover">
                                            <td className="font-mono text-base">{track.position}</td>
                                            <td>
                                                <div className="font-medium">{track.title}</div>
                                                {track.artist && (
                                                    <div className="text-sm text-base-content/60">{track.artist}</div>
                                                )}
                                            </td>
                                            <td className="text-right font-mono">{track.duration || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </details>
            )}

        </div>
    );
};

export default AlbumDetailPage;
