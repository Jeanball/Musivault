import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Users, Music, Mic, Lock, Calendar, Ticket, ChevronRight, AlertCircle } from 'lucide-react';

interface PublicUser {
    username: string;
    publicShareId: string;
    albumCount: number;
    createdAt: string;
}

const DiscoverPage: React.FC = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<PublicUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        const fetchPublicUsers = async () => {
            try {
                const response = await axios.get('/api/public/users');
                setUsers(response.data);
            } catch (err) {
                console.error('Failed to fetch public users:', err);
                setError(t('discover.failedLoadCollections'));
            } finally {
                setIsLoading(false);
            }
        };

        fetchPublicUsers();
    }, []);

    return (
        <div className="max-w-6xl mx-auto space-y-12">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{t('discover.title')}</h1>
                <p className="text-base-content/70">
                    {t('discover.subtitle')}
                </p>
            </div>

            {/* Section 1: Public Collections */}
            <section>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Users size={24} />
                    {t('discover.publicCollections')}
                </h2>

                {isLoading ? (
                    <div className="flex justify-center items-center h-32">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                    </div>
                ) : error ? (
                    <div className="alert alert-error">
                        <AlertCircle className="shrink-0 h-6 w-6" />
                        <span>{error}</span>
                    </div>
                ) : users.length === 0 ? (
                    <div className="bg-base-200 rounded-xl p-8 text-center border-2 border-dashed border-base-300">
                        <div className="flex justify-center mb-4">
                            <Lock size={48} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{t('discover.noPublicCollections')}</h3>
                        <p className="text-base-content/60 mb-4">
                            {t('discover.beTheFirst')}
                        </p>
                        <Link to="/app/settings" className="btn btn-primary btn-sm">{t('discover.goToSettings')}</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map((user) => (
                            <Link
                                key={user.publicShareId}
                                to={`/app/shared/${user.publicShareId}`}
                                className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-base-300"
                            >
                                <div className="card-body p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="avatar placeholder">
                                            <div className="bg-primary text-primary-content rounded-full w-12">
                                                <span className="text-xl font-bold">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate">{user.username}</h3>
                                            <p className="text-sm text-base-content/60">
                                                {user.albumCount} {user.albumCount === 1 ? t('common.album') : t('common.albums')}
                                            </p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-base-content/40" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* Section 2: Upcoming Releases - Coming Soon */}
            <section>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Music size={24} />
                        {t('discover.upcomingReleases')}
                    </h2>
                    <span className="badge badge-primary badge-outline whitespace-nowrap">{t('discover.comingSoon')}</span>
                </div>
                <div className="bg-base-200 rounded-xl p-6 md:p-8 text-center border-2 border-dashed border-base-300">
                    <div className="flex justify-center mb-4">
                        <Calendar size={48} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{t('discover.newMusicFromArtists')}</h3>
                    <p className="text-base-content/60 max-w-md mx-auto text-sm md:text-base">
                        {t('discover.upcomingReleasesDescription')}
                    </p>
                </div>
            </section>

            {/* Section 3: Shows Near You - Coming Soon */}
            <section>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Mic size={24} />
                        {t('discover.showsNearYou')}
                    </h2>
                    <span className="badge badge-primary badge-outline whitespace-nowrap">{t('discover.comingSoon')}</span>
                </div>
                <div className="bg-base-200 rounded-xl p-6 md:p-8 text-center border-2 border-dashed border-base-300">
                    <div className="flex justify-center mb-4">
                        <Ticket size={48} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{t('discover.liveConcerts')}</h3>
                    <p className="text-base-content/60 max-w-md mx-auto text-sm md:text-base">
                        {t('discover.showsDescription')}
                    </p>
                </div>
            </section>
        </div>
    );
};

export default DiscoverPage;

