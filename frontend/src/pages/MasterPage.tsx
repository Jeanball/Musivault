/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ArrowLeft, ChevronDown, Plus } from 'lucide-react';
import { useParams, useNavigate } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toastService } from '../utils/toast';
import { type AlbumDetails, type FormatDetails } from '../components/Modal/AddAlbumVersionModal';
import ConditionModal from '../components/Modal/ConditionModal';
import ConfirmAddModal from '../components/Modal/ConfirmAddModal';
import { getFormatButtonStyle } from '../utils/formatColors';

interface MasterVersion {
    id: number;
    title: string;
    format: string;
    label: string;
    country: string;
    released: string;
    majorFormat: string;
}
interface VersionsPageData {
    masterTitle: string;
    coverImage: string;
    formatCounts: { [key: string]: number };
    countryCounts: { [key: string]: number };
    versions: MasterVersion[];
}

type FormatFilter = 'all' | 'CD' | 'Vinyl' | 'Cassette';

interface AddedAlbumInfo {
    id: string;
    title: string;
}

interface PreferencesResponse {
    enableConditionGrading: boolean;
}

const VERSIONS_PER_PAGE = 5;

const MasterPage: React.FC = () => {
    const { masterId } = useParams<{ masterId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [pageData, setPageData] = useState<VersionsPageData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [filter, setFilter] = useState<FormatFilter>('all');
    const [countryFilter, setCountryFilter] = useState<string>('all');

    // Display pagination
    const [visibleCount, setVisibleCount] = useState<number>(VERSIONS_PER_PAGE);

    // Release details cache: releaseId -> AlbumDetails
    const [releaseDetailsCache, setReleaseDetailsCache] = useState<Map<number, AlbumDetails>>(new Map());
    const [loadingReleaseIds, setLoadingReleaseIds] = useState<Set<number>>(new Set());

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [addedAlbum, setAddedAlbum] = useState<AddedAlbumInfo | null>(null);

    // Confirmation modal state
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    const [confirmAlbum, setConfirmAlbum] = useState<AlbumDetails | null>(null);
    const [confirmFormat, setConfirmFormat] = useState<FormatDetails | null>(null);

    // Condition grading state
    const [conditionGradingEnabled, setConditionGradingEnabled] = useState<boolean>(false);
    const [showConditionModal, setShowConditionModal] = useState<boolean>(false);
    const [pendingFormat, setPendingFormat] = useState<FormatDetails | null>(null);
    const [pendingAlbum, setPendingAlbum] = useState<AlbumDetails | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!masterId) return;
            try {
                const [versionsRes, prefsRes] = await Promise.all([
                    axios.get<VersionsPageData>(`/api/discogs/master/${masterId}/versions`, { withCredentials: true }),
                    axios.get<PreferencesResponse>('/api/users/preferences', { withCredentials: true })
                ]);
                setPageData(versionsRes.data);
                setConditionGradingEnabled(prefsRes.data.enableConditionGrading || false);
            } catch (error) {
                console.log("Error charging versions on this album: ", error)
                toastService.error(t('versions.errorLoadingVersions'));
                navigate('/');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [masterId, navigate, t]);

    const filteredVersions = useMemo(() => {
        if (!pageData) return [];
        return pageData.versions.filter(version => {
            const matchesFormat = filter === 'all' ||
                version.majorFormat.toLowerCase().includes(filter.toLowerCase());
            const matchesCountry = countryFilter === 'all' ||
                version.country === countryFilter;
            return matchesFormat && matchesCountry;
        });
    }, [pageData, filter, countryFilter]);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(VERSIONS_PER_PAGE);
    }, [filter, countryFilter]);

    // Visible versions (paginated display)
    const visibleVersions = useMemo(() => {
        return filteredVersions.slice(0, visibleCount);
    }, [filteredVersions, visibleCount]);

    // Group visible versions by attributes for rendering
    const groupedVisibleVersions = useMemo(() => {
        const groups: { [key: string]: { header: { released: string, majorFormat: string, label: string, country: string }, versions: MasterVersion[] } } = {};
        visibleVersions.forEach(version => {
            const key = `${version.released || 'N/A'}|${version.majorFormat}|${version.label}|${version.country || ''}`;
            if (!groups[key]) {
                groups[key] = {
                    header: {
                        released: version.released,
                        majorFormat: version.majorFormat,
                        label: version.label,
                        country: version.country
                    },
                    versions: []
                };
            }
            groups[key].versions.push(version);
        });
        return Object.values(groups);
    }, [visibleVersions]);

    // Auto-fetch release details for visible versions
    const fetchReleaseDetails = useCallback(async (releaseId: number) => {
        if (releaseDetailsCache.has(releaseId) || loadingReleaseIds.has(releaseId)) return;

        setLoadingReleaseIds(prev => new Set(prev).add(releaseId));
        try {
            const response = await axios.get<AlbumDetails>(`/api/discogs/release/${releaseId}`, { withCredentials: true });
            setReleaseDetailsCache(prev => {
                const updated = new Map(prev);
                updated.set(releaseId, response.data);
                return updated;
            });
        } catch (err) {
            console.log(`Error fetching release ${releaseId}:`, err);
        } finally {
            setLoadingReleaseIds(prev => {
                const updated = new Set(prev);
                updated.delete(releaseId);
                return updated;
            });
        }
    }, [releaseDetailsCache, loadingReleaseIds]);

    // Fetch details for all currently visible versions
    useEffect(() => {
        visibleVersions.forEach(version => {
            if (!releaseDetailsCache.has(version.id) && !loadingReleaseIds.has(version.id)) {
                fetchReleaseDetails(version.id);
            }
        });
    }, [visibleVersions]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleShowMore = () => {
        setVisibleCount(prev => prev + VERSIONS_PER_PAGE);
    };

    const handleFormatClick = (album: AlbumDetails, format: FormatDetails) => {
        setConfirmAlbum(album);
        setConfirmFormat(format);
        setShowConfirmModal(true);
    };

    const handleConfirmAdd = () => {
        setShowConfirmModal(false);
        if (!confirmAlbum || !confirmFormat) return;

        if (conditionGradingEnabled) {
            setPendingFormat(confirmFormat);
            setPendingAlbum(confirmAlbum);
            setShowConditionModal(true);
        } else {
            addToCollection(confirmAlbum, confirmFormat, null, null);
        }
        setConfirmAlbum(null);
        setConfirmFormat(null);
    };

    const handleConfirmCancel = () => {
        setShowConfirmModal(false);
        setConfirmAlbum(null);
        setConfirmFormat(null);
    };

    const handleConditionConfirm = (mediaCondition: string | null, sleeveCondition: string | null) => {
        setShowConditionModal(false);
        if (pendingFormat && pendingAlbum) {
            addToCollection(pendingAlbum, pendingFormat, mediaCondition, sleeveCondition);
        }
    };

    const handleConditionSkip = () => {
        setShowConditionModal(false);
        if (pendingFormat && pendingAlbum) {
            addToCollection(pendingAlbum, pendingFormat, null, null);
        }
    };

    const addToCollection = async (
        album: AlbumDetails,
        format: FormatDetails,
        mediaCondition: string | null,
        sleeveCondition: string | null
    ) => {
        setIsSubmitting(true);
        try {
            const response = await axios.post('/api/collection', {
                ...album,
                format,
                mediaCondition,
                sleeveCondition
            }, { withCredentials: true });
            toastService.success(t('common.addedSuccess', { title: album.title }));
            setAddedAlbum({
                id: response.data.item._id,
                title: album.title
            });
            setPendingFormat(null);
            setPendingAlbum(null);
        } catch (err: any) {
            toastService.error(err.response?.data?.message || t('app.error'));
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
        return <div className="flex justify-center items-center min-h-screen"><span className="loading loading-spinner loading-lg"></span></div>;
    }

    if (!pageData) {
        return <div className="text-center p-8">{t('versions.noData')}</div>
    }

    const hasMore = visibleCount < filteredVersions.length;
    const remaining = filteredVersions.length - visibleCount;

    return (
        <div className="p-4 md:p-8" >
            <div className="flex flex-col md:flex-row gap-8">

                <div className="md:w-1/3 lg:w-1/4 flex-shrink-0">
                    {pageData.coverImage && (
                        <img src={pageData.coverImage} alt={`Pochette de ${pageData.masterTitle}`} className="w-full h-auto object-cover rounded-lg shadow-2xl" />
                    )}
                    <h1 className="text-2xl font-bold mt-4">{pageData.masterTitle}</h1>
                    <p className="text-gray-400">{t('versions.chooseVersion')}</p>
                </div>

                <div className="flex-1">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium mr-1">{t('versions.filterBy')}</p>
                            <button onClick={() => setFilter('all')} className={`btn btn-xs ${filter === 'all' ? 'btn-active btn-neutral' : ''}`}>{t('versions.all')}</button>
                            {pageData.formatCounts.CD > 0 && (
                                <button onClick={() => setFilter('CD')} className={`btn btn-xs ${filter === 'CD' ? 'btn-active btn-neutral' : ''}`}>
                                    CD <div className="badge badge-primary ml-2">{pageData.formatCounts.CD}</div>
                                </button>
                            )}
                            {pageData.formatCounts.Vinyl > 0 && (
                                <button onClick={() => setFilter('Vinyl')} className={`btn btn-xs ${filter === 'Vinyl' ? 'btn-active btn-neutral' : ''}`}>
                                    Vinyl <div className="badge badge-primary ml-2">{pageData.formatCounts.Vinyl}</div>
                                </button>
                            )}
                            {pageData.formatCounts.Cassette > 0 && (
                                <button onClick={() => setFilter('Cassette')} className={`btn btn-xs ${filter === 'Cassette' ? 'btn-active btn-neutral' : ''}`}>
                                    Cassette <div className="badge badge-primary ml-2">{pageData.formatCounts.Cassette}</div>
                                </button>
                            )}

                            {/* Country filter dropdown */}
                            {Object.keys(pageData.countryCounts || {}).length > 1 && (
                                <select
                                    className="select select-sm select-bordered w-full sm:w-auto mt-2 sm:mt-0 sm:ml-2"
                                    value={countryFilter}
                                    onChange={(e) => setCountryFilter(e.target.value)}
                                >
                                    <option value="all">{t('versions.allCountries')}</option>
                                    {Object.entries(pageData.countryCounts || {})
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([country, count]) => (
                                            <option key={country} value={country}>
                                                {country} ({count})
                                            </option>
                                        ))
                                    }
                                </select>
                            )}
                        </div>
                        <button onClick={() => navigate(-1)} className="btn btn-sm btn-outline gap-2">
                            <ArrowLeft size={16} /> {t('common.back')}
                        </button>
                    </div>

                    {filteredVersions.length === 0 ? (
                        pageData.versions.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-4">📁</div>
                                <h3 className="text-lg font-semibold mb-2">{t('versions.noPhysicalVersions')}</h3>
                                <p className="text-gray-400">{t('versions.digitalOnly')}</p>
                                <button onClick={() => navigate(-1)} className="btn btn-primary btn-sm mt-4">{t('versions.goBack')}</button>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-4">🔍</div>
                                <h3 className="text-lg font-semibold mb-2">{t('versions.noVersionsMatch')}</h3>
                                <p className="text-gray-400">{t('versions.adjustFilters')}</p>
                                <button
                                    onClick={() => { setFilter('all'); setCountryFilter('all'); }}
                                    className="btn btn-outline btn-sm mt-4"
                                >
                                    {t('versions.resetFilters')}
                                </button>
                            </div>
                        )
                    ) : (
                        <div className="space-y-4">
                            {groupedVisibleVersions.map((group, groupIdx) => (
                                <div key={groupIdx} className="bg-base-200/30 rounded-lg p-4 border border-base-200 hover:border-base-300 transition-colors">
                                    {/* Group Header Info */}
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
                                        <span className="font-bold text-lg whitespace-nowrap">{group.header.released || 'N/A'}</span>
                                        <span className="text-base-content/40 hidden sm:inline">•</span>
                                        <span className="font-medium text-base-content/90 truncate max-w-[200px] sm:max-w-[250px]" title={group.header.majorFormat}>{group.header.majorFormat}</span>
                                        <span className="text-base-content/40 hidden sm:inline">•</span>
                                        <span className="text-base-content/70 truncate max-w-[200px] sm:max-w-[250px]" title={group.header.label}>{group.header.label}</span>
                                        <span className="text-base-content/40 hidden sm:inline">•</span>
                                        <span className="text-sm bg-base-200 px-2 py-0.5 rounded font-medium whitespace-nowrap">{group.header.country || t('versions.unknown')}</span>
                                    </div>

                                    {/* Formats list for this group */}
                                    <div className="flex flex-col gap-2 pl-2 border-l-2 border-base-300/50">
                                        {(() => {
                                            let isGroupLoading = false;
                                            const uniqueFormatsMap = new Map();

                                            group.versions.forEach(version => {
                                                if (loadingReleaseIds.has(version.id)) {
                                                    isGroupLoading = true;
                                                }
                                                const details = releaseDetailsCache.get(version.id);
                                                if (details && details.availableFormats) {
                                                    details.availableFormats.forEach(format => {
                                                        const key = `${format.text || ''}|${(format.descriptions || []).join(',')}`;
                                                        if (!uniqueFormatsMap.has(key)) {
                                                            uniqueFormatsMap.set(key, { details, format, versionId: version.id });
                                                        }
                                                    });
                                                }
                                            });

                                            if (isGroupLoading) {
                                                return (
                                                    <div className="text-sm text-base-content/40 flex items-center py-1">
                                                        <span className="loading loading-spinner loading-xs mr-2"></span>
                                                        {t('versions.loadingFormats')}
                                                    </div>
                                                );
                                            }

                                            const uniqueFormats = Array.from(uniqueFormatsMap.values());

                                            if (uniqueFormats.length === 0) {
                                                return null;
                                            }

                                            return uniqueFormats.map((item, index) => {
                                                const { details, format, versionId } = item;
                                                
                                                const descStr = format.descriptions?.join(', ') || '';
                                                const displayTitle = format.text || descStr || format.name;
                                                const displaySubtitle = format.text ? descStr : '';

                                                return (
                                                    <button
                                                        key={`${versionId}-fmt-${index}`}
                                                        className="btn btn-sm btn-outline border-base-300 hover:border-primary/50 normal-case justify-start text-left group/btn transition-all w-full h-auto py-2 px-3"
                                                        onClick={() => details && handleFormatClick(details, format)}
                                                        disabled={isSubmitting}
                                                        title={t('versions.clickToAdd')}
                                                        style={getFormatButtonStyle(format.text, format.descriptions)}
                                                    >
                                                        <div className="flex flex-col items-start min-w-0 flex-1 w-full gap-0.5">
                                                            <div className="flex items-center w-full">
                                                                <span className="font-bold whitespace-normal break-words overflow-hidden text-sm mr-1.5">{displayTitle}</span>
                                                                <Plus size={16} className="opacity-0 group-hover/btn:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                                                            </div>
                                                            {displaySubtitle && (
                                                                <span className="text-xs opacity-80 break-words whitespace-normal leading-tight mt-0.5 text-base-content/80 font-medium">
                                                                    {displaySubtitle}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* See more button */}
                    {hasMore && (
                        <div className="flex justify-center mt-6">
                            <button
                                className="btn btn-ghost gap-2"
                                onClick={handleShowMore}
                            >
                                <ChevronDown size={18} />
                                {t('versions.seeMore', { remaining: remaining > VERSIONS_PER_PAGE ? VERSIONS_PER_PAGE : remaining, total: filteredVersions.length })}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmAddModal
                isOpen={showConfirmModal}
                coverImage={confirmAlbum?.cover_image}
                albumTitle={confirmAlbum?.title}
                format={confirmFormat}
                onConfirm={handleConfirmAdd}
                onCancel={handleConfirmCancel}
            />

            {/* Condition Modal */}
            <ConditionModal
                isOpen={showConditionModal}
                albumTitle={pendingAlbum?.title || ''}
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
                        <button onClick={() => setAddedAlbum(null)}>{t('common.close')}</button>
                    </form>
                </dialog>
            )}
        </div>

    );
};

export default MasterPage;
