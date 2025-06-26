/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import axios from 'axios';
import { toast } from 'react-toastify';
import AlbumDetailModal, { type AlbumDetails } from '../components/AlbumDetailModal';

// --- Interfaces mises à jour pour correspondre au nouveau format du backend ---
interface MasterVersion {
    id: number;
    title: string;
    format: string; // Le format détaillé complet, pour la modale
    label: string;
    country: string;
    released: string;
    majorFormat: string;
}
interface VersionsPageData {
    masterTitle: string;
    coverImage: string; // L'image de couverture du master
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

    // --- Logique pour la modale (inchangée) ---
    const [selectedAlbum, setSelectedAlbum] = useState<AlbumDetails | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    useEffect(() => {
        const fetchVersions = async () => {
            if (!masterId) return;
            try {
                const { data } = await axios.get<VersionsPageData>(`/api/discogs/master/${masterId}/versions`, {
                    withCredentials: true
                });
                console.log("Données reçues du backend pour la page des versions :", data);
                setPageData(data);
            } catch (error) {
                console.log(error)
                toast.error("Impossible de charger les versions de cet album.");
                navigate('/');
            } finally {
                setIsLoading(false);
            }
        };
        fetchVersions();
    }, [masterId, navigate]);

    // La logique de filtrage utilise maintenant majorFormat
    const filteredVersions = useMemo(() => {
        if (!pageData) return [];
        if (filter === 'all') return pageData.versions;
        return pageData.versions.filter(version => 
            version.majorFormat.toLowerCase().includes(filter.toLowerCase())
        );
    }, [pageData, filter]);

    // --- Fonctions de la modale (inchangées) ---
    const handleShowDetails = async (releaseId: number) => {
        try {
            const response = await axios.get<AlbumDetails>(`/api/discogs/release/${releaseId}`, { withCredentials: true });
            setSelectedAlbum(response.data);
        } catch (err) {
            console.log(err)
            toast.error("Impossible de récupérer les détails de cette version.");
        }
    };

    const handleConfirmAddToCollection = async (format: any) => {
        if (!selectedAlbum) return;
        setIsSubmitting(true);
        try {
            await axios.post('/api/collection', { ...selectedAlbum, format }, { withCredentials: true });
            toast.success(`"${selectedAlbum.title}" a été ajouté à votre collection !`);
            setSelectedAlbum(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Une erreur est survenue.");
        } finally {
            setIsSubmitting(false);
        }
    };


    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen"><span className="loading loading-spinner loading-lg"></span></div>;
    }

    if (!pageData) {
        return <div className="text-center p-8">Aucune donnée trouvée pour cet album.</div>
    }

    return (
        <div className="p-4 md:p-8" data-theme="dark">
            {/* --- NOUVELLE STRUCTURE DE MISE EN PAGE --- */}
            <div className="flex flex-col md:flex-row gap-8">
                
                {/* --- COLONNE DE GAUCHE : IMAGE ET TITRE --- */}
                <div className="md:w-1/3 lg:w-1/4 flex-shrink-0">
                    {pageData.coverImage && (
                        <img src={pageData.coverImage} alt={`Pochette de ${pageData.masterTitle}`} className="w-full h-auto object-cover rounded-lg shadow-2xl" />
                    )}
                    <h1 className="text-2xl font-bold mt-4">{pageData.masterTitle}</h1>
                    <p className="text-gray-400">Sélectionnez la version que vous possédez.</p>
                </div>

                {/* --- COLONNE DE DROITE : FILTRES ET TABLEAU --- */}
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-4">
                         <div className="flex items-center gap-2">
                            <p className="text-sm">Filtrer par :</p>
                            <button onClick={() => setFilter('all')} className={`btn btn-xs ${filter === 'all' ? 'btn-active btn-neutral' : ''}`}>Tous</button>
                            {pageData.formatCounts.CD > 0 && (
                                <button onClick={() => setFilter('CD')} className={`btn btn-xs ${filter === 'CD' ? 'btn-active btn-neutral' : ''}`}>
                                    CD <div className="badge badge-secondary ml-2">{pageData.formatCounts.CD}</div>
                                </button>
                            )}
                            {pageData.formatCounts.Vinyl > 0 && (
                                <button onClick={() => setFilter('Vinyl')} className={`btn btn-xs ${filter === 'Vinyl' ? 'btn-active btn-neutral' : ''}`}>
                                    Vinyl <div className="badge badge-accent ml-2">{pageData.formatCounts.Vinyl}</div>
                                </button>
                            )}
                        </div>
                        <Link to="/" className="btn btn-sm btn-outline">Revenir à la recherche</Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Sortie</th>
                                    <th>Format</th>
                                    <th>Label</th>
                                    <th>Pays</th>
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
                                            <button className="btn btn-sm btn-secondary" onClick={() => handleShowDetails(version.id)}>
                                                Ajouter...
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
