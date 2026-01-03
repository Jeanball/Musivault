import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import CollectionContent from '../components/Collection/CollectionContent';
import Footer from '../components/Footer';
import type { CollectionItem } from '../types/collection';

interface PublicCollectionResponse {
    username: string;
    collection: CollectionItem[];
    total: number;
}

const PublicCollectionPage: React.FC = () => {
    const { shareId } = useParams<{ shareId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [username, setUsername] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPublicCollection = async () => {
            if (!shareId) return;

            try {
                const response = await axios.get<PublicCollectionResponse>(`/api/public/${shareId}`);
                setCollection(response.data.collection);
                setUsername(response.data.username);
            } catch (err: any) {
                if (err.response?.status === 404) {
                    setError(t('publicCollection.notFound'));
                } else {
                    setError(t('publicCollection.failedLoad'));
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchPublicCollection();
    }, [shareId]);

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-base-100 p-8" data-theme="dark">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">🔒</h1>
                    <h2 className="text-2xl font-bold mb-2">{error}</h2>
                    <p className="text-base-content/70 mb-6">
                        {t('publicCollection.mayBePrivate')}
                    </p>
                    <Link to="/" className="btn btn-primary">
                        {t('publicCollection.goToHomepage')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-100 p-2 md:p-4" data-theme="dark">
            {/* Public Collection Header */}
            {!isLoading && (
                <div className="mb-6">
                    <div className="flex items-start gap-2 mb-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="btn btn-ghost btn-circle flex-shrink-0"
                            title="Go Back"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div className="text-center flex-1">
                            <h1 className="text-3xl md:text-4xl font-bold mb-2">
                                {username}'s Collection
                            </h1>
                        </div>
                        {/* Spacer for visual balance */}
                        <div className="w-12 flex-shrink-0"></div>
                    </div>
                </div>
            )}

            <CollectionContent
                collection={collection}
                isLoading={isLoading}
                readOnly={true}
            />

            {/* Footer */}
            {!isLoading && (
                <div className="mt-12">
                    <Footer />
                </div>
            )}
        </div>
    );
};

export default PublicCollectionPage;
