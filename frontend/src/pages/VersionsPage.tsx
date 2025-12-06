/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import axios from 'axios';
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
    versions: MasterVersion[];
}

type FormatFilter = 'all' | 'CD' | 'Vinyl';

const VersionsPage: React.FC = () => {
    const { masterId } = useParams<{ masterId: string }>();
    const navigate = useNavigate();
    const [pageData, setPageData] = useState<VersionsPageData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [filter, setFilter] = useState<FormatFilter>('all');

    const [selectedAlbum, setSelectedAlbum] = useState<AlbumDetails | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
                toastService.error("Error charging versions on this album.");
                navigate('/');
            } finally {
                setIsLoading(false);
            }
        };
        fetchVersions();
    }, [masterId, navigate]);

    const filteredVersions = useMemo(() => {
        if (!pageData) return [];
        if (filter === 'all') return pageData.versions;
        return pageData.versions.filter(version =>
            version.majorFormat.toLowerCase().includes(filter.toLowerCase())
        );
    }, [pageData, filter]);

    const handleShowDetails = async (releaseId: number) => {
        try {
            const response = await axios.get<AlbumDetails>(`/api/discogs/release/${releaseId}`, { withCredentials: true });
            setSelectedAlbum(response.data);
        } catch (err) {
            console.log(err)
            toastService.error("Error by retrieving data on this version.");
        }
    };

    const handleConfirmAddToCollection = async (format: any) => {
        if (!selectedAlbum) return;
        setIsSubmitting(true);
        try {
            await axios.post('/api/collection', { ...selectedAlbum, format }, { withCredentials: true });
            toastService.success(`"${selectedAlbum.title}" added to your collection!`);
            console.log(selectedAlbum.title)
            setSelectedAlbum(null);
        } catch (err: any) {
            toastService.error(err.response?.data?.message || "An error occured.");
        } finally {
            setIsSubmitting(false);
        }
    };


    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen"><span className="loading loading-spinner loading-lg"></span></div>;
    }

    if (!pageData) {
        return <div className="text-center p-8">No data for this album.</div>
    }

    return (
        <div className="p-4 md:p-8" >
            <div className="flex flex-col md:flex-row gap-8">

                <div className="md:w-1/3 lg:w-1/4 flex-shrink-0">
                    {pageData.coverImage && (
                        <img src={pageData.coverImage} alt={`Pochette de ${pageData.masterTitle}`} className="w-full h-auto object-cover rounded-lg shadow-2xl" />
                    )}
                    <h1 className="text-2xl font-bold mt-4">{pageData.masterTitle}</h1>
                    <p className="text-gray-400">Choose your version.</p>
                </div>

                <div className="flex-1">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <p className="text-sm">Filtrer par :</p>
                            <button onClick={() => setFilter('all')} className={`btn btn-xs ${filter === 'all' ? 'btn-active btn-neutral' : ''}`}>All</button>
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
                        </div>
                        <button onClick={() => navigate(-1)} className="btn btn-sm btn-outline">← Back</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Released</th>
                                    <th>Format</th>
                                    <th>Label</th>
                                    <th>Country</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVersions.map((version) => (
                                    <tr key={version.id} className="hover">
                                        <td>{version.released || 'N/A'}</td>
                                        <td>{version.majorFormat}</td>
                                        <td>{version.label}</td>
                                        <td>{version.country}</td>
                                        <td className="text-right">
                                            <button className="btn btn-sm btn-primary" onClick={() => handleShowDetails(version.id)}>
                                                Add
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <AlbumDetailModal
                album={selectedAlbum}
                onClose={() => setSelectedAlbum(null)}
                onConfirm={handleConfirmAddToCollection}
                isSubmitting={isSubmitting}
            />
        </div>

    );
};

export default VersionsPage;
