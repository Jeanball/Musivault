import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Lock, ArrowLeft } from 'lucide-react';
import CollectionContent from '../components/Collection/CollectionContent';
import type { CollectionItem } from '../types/collection.types';

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
            <div className="flex flex-col items-center justify-center p-8">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <Lock size={48} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">{error}</h2>
                    <p className="text-base-content/70 mb-6">
                        {t('publicCollection.mayBePrivate')}
                    </p>
                    <Link to="/app" className="btn btn-primary">
                        {t('common.goBack')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="p-2 md:p-4">
            {/* Public Collection Header */}
            {!isLoading && (
                <div className="mb-6">
                    <div className="flex items-start gap-2 mb-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="btn btn-ghost btn-circle flex-shrink-0"
                            title="Go Back"
                        >
                            <ArrowLeft className="h-6 w-6" />
                        </button>
                        <div className="text-center flex-1">
                            <h1 className="text-3xl md:text-4xl font-bold mb-2">
                                {t('publicCollection.collectionOf', { username })}
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
        </div>
    );
};

export default PublicCollectionPage;

