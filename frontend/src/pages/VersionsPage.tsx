/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toastService } from '../utils/toast';
import AlbumDetailModal, { type AlbumDetails } from '../components/Modal/AddAlbumVersionModal';

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

const VersionsPage: React.FC = () => {
    const { masterId } = useParams<{ masterId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [pageData, setPageData] = useState<VersionsPageData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [filter, setFilter] = useState<FormatFilter>('all');
    const [countryFilter, setCountryFilter] = useState<string>('all');

    const [selectedAlbum, setSelectedAlbum] = useState<AlbumDetails | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [addedAlbum, setAddedAlbum] = useState<AddedAlbumInfo | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        const fetchVersions = async () => {
            if (!masterId) return;
            try {
                const { data } = await axios.get<VersionsPageData>(`/api/discogs/master/${masterId}/versions`, {
                    withCredentials: true
                });
                setPageData(data);
            } catch (error) {
                console.log("Error charging versions on this album: ", error)
                toastService.error(t('versions.errorLoadingVersions'));
                navigate('/');
            } finally {
                setIsLoading(false);
            }
        };
        fetchVersions();
    }, [masterId, navigate]);

    const filteredVersions = useMemo(() => {
        if (!pageData) return [];
        return pageData.versions.filter(version => {
            // Filter by format
            const matchesFormat = filter === 'all' ||
                version.majorFormat.toLowerCase().includes(filter.toLowerCase());
            // Filter by country
            const matchesCountry = countryFilter === 'all' ||
                version.country === countryFilter;
            return matchesFormat && matchesCountry;
        });
    }, [pageData, filter, countryFilter]);

    const handleShowDetails = async (releaseId: number) => {
        try {
            const response = await axios.get<AlbumDetails>(`/api/discogs/release/${releaseId}`, { withCredentials: true });
            setSelectedAlbum(response.data);
        } catch (err) {
            console.log(err)
            toastService.error(t('versions.errorRetrievingData'));
        }
    };

    const handleConfirmAddToCollection = async (format: any) => {
        if (!selectedAlbum) return;
        setIsSubmitting(true);
        try {
            const response = await axios.post('/api/collection', { ...selectedAlbum, format }, { withCredentials: true });
            toastService.success(t('search.addedToCollection', { title: selectedAlbum.title }));
            setAddedAlbum({
                id: response.data.item._id,
                title: selectedAlbum.title
            });
            setSelectedAlbum(null);
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
                        <button onClick={() => navigate(-1)} className="btn btn-sm btn-outline">{t('common.back')}</button>
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredVersions.map((version) => (
                                <div key={version.id} className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="card-body p-3 flex flex-col h-full">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-lg">{version.released || 'N/A'}</span>
                                        </div>

                                        <div className="space-y-1 flex-1">
                                            <div className="font-medium text-sm truncate" title={version.majorFormat}>{version.majorFormat}</div>
                                            <div className="text-xs text-gray-500 truncate mb-2" title={version.label}>
                                                {version.label}
                                            </div>

                                            <div className="text-xs bg-base-100 rounded px-2 py-1.5 flex items-start gap-1.5 w-full" title={version.country}>
                                                <span className="opacity-70 mt-0.5 flex-shrink-0">🌍</span>
                                                <span className="font-medium whitespace-normal leading-tight">{version.country || t('versions.unknown')}</span>
                                            </div>
                                        </div>

                                        <div className="card-actions mt-3">
                                            <button
                                                className="btn btn-primary btn-xs w-full"
                                                onClick={() => handleShowDetails(version.id)}
                                            >
                                                {t('versions.select')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <AlbumDetailModal
                album={selectedAlbum}
                onClose={() => setSelectedAlbum(null)}
                onConfirm={handleConfirmAddToCollection}
                isSubmitting={isSubmitting}
            />

            {/* Success Modal - Choice after adding */}
            {addedAlbum && (
                <dialog className="modal modal-open">
                    <div className="modal-box text-center">
                        <div className="text-5xl mb-4">🎉</div>
                        <h3 className="font-bold text-xl mb-2">{t('versions.albumAdded')}</h3>
                        <p className="text-base-content/70 mb-6">
                            {t('versions.addedToCollection', { title: addedAlbum.title })}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                className="btn btn-primary"
                                onClick={handleGoToAlbum}
                            >
                                {t('versions.viewAlbum')}
                            </button>
                            <button
                                className="btn btn-outline"
                                onClick={handleContinueSearching}
                            >
                                {t('versions.continueSearching')}
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

export default VersionsPage;
