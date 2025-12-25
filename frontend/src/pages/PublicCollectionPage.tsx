import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import axios from 'axios';
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
                    setError('Collection not found or is private');
                } else {
                    setError('Failed to load collection');
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
                        This collection may be private or the link may be invalid.
                    </p>
                    <Link to="/" className="btn btn-primary">
                        Go to Homepage
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-100 p-2 md:p-4" data-theme="dark">
            {/* Public Collection Header */}
            {!isLoading && (
                <div className="mb-6 relative">
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn-ghost btn-circle absolute left-0 top-0 md:left-4 md:top-2"
                        title="Go Back"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div className="text-center pt-2">
                        <h1 className="text-3xl md:text-4xl font-bold mb-2">
                            {username}'s Collection
                        </h1>
                        <p className="text-base-content/60">
                            Powered by <Link to="/" className="link link-primary">Musivault</Link>
                        </p>
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
