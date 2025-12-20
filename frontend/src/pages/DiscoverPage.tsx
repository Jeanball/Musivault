import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router';

interface PublicUser {
    username: string;
    publicShareId: string;
    albumCount: number;
    createdAt: string;
}

const DiscoverPage: React.FC = () => {
    const [users, setUsers] = useState<PublicUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPublicUsers = async () => {
            try {
                const response = await axios.get('/api/public/users');
                setUsers(response.data);
            } catch (err) {
                console.error('Failed to fetch public users:', err);
                setError('Failed to load public collections.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPublicUsers();
    }, []);

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">Discover</h1>
                <p className="text-base-content/70">
                    Explore public collections from other users on this instance.
                </p>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            ) : error ? (
                <div className="alert alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{error}</span>
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-12 bg-base-200 rounded-xl">
                    <div className="text-6xl mb-4">🔒</div>
                    <h3 className="text-xl font-bold mb-2">No public collections yet</h3>
                    <p className="opacity-70">
                        Be the first! Enable public sharing in your Settings.
                    </p>
                    <Link to="/app/settings" className="btn btn-primary mt-4">Go to Settings</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {users.map((user) => (
                        <Link
                            key={user.publicShareId}
                            to={`/collection/${user.publicShareId}`}
                            className="card bg-base-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-base-300"
                        >
                            <div className="card-body">
                                <div className="flex items-center gap-4">
                                    <div className="avatar placeholder">
                                        <div className="bg-primary text-primary-content rounded-full w-14">
                                            <span className="text-2xl font-bold">
                                                {user.username.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="card-title text-lg">{user.username}</h2>
                                        <p className="text-base-content/60">
                                            {user.albumCount} {user.albumCount === 1 ? 'album' : 'albums'}
                                        </p>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DiscoverPage;
