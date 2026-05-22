import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Users, Music, Mic, Lock, Calendar, Ticket, AlertCircle } from 'lucide-react';
import { getImageUrl } from '../utils/imageUrl';

interface PublicUser {
    username: string;
    publicShareId: string;
    albumCount: number;
    createdAt: string;
    latestAlbums?: any[];
}

const DiscoverPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
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
                    <div className="space-y-6">
                        {users.map((user) => (
                            <div key={user.publicShareId} className="bg-base-200 rounded-xl p-5 border border-base-300">
                                {/* User Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="avatar placeholder">
                                            <div className="bg-primary text-primary-content rounded-full w-12 h-12">
                                                <span className="text-xl font-bold">
                                                    {user.username.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{user.username}</h3>
                                            <p className="text-sm text-base-content/60">
                                                {user.albumCount} {user.albumCount === 1 ? t('common.album') : t('common.albums')}
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        to={`/shared/${user.publicShareId}`}
                                        className="btn btn-outline btn-sm"
                                    >
                                        {t('discover.viewCollection')}
                                    </Link>
                                </div>
                                
                                {/* Latest Albums for User */}
                                {user.latestAlbums && user.latestAlbums.length > 0 ? (
                                    <div className="mt-4">
                                        <h4 className="text-sm font-semibold mb-3 text-base-content/70">
                                            {t('discover.latestUserAdditions', 'Latest additions')}
                                        </h4>
                                        <div className="flex overflow-x-auto pb-4 gap-3 sm:grid sm:grid-cols-3 md:grid-cols-5 sm:overflow-visible sm:pb-0 snap-x">
                                        {user.latestAlbums.map((item) => (
                                            <div
                                                key={item._id}
                                                onClick={() => navigate(`/shared/${user.publicShareId}`)}
                                                className="card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer group shrink-0 w-32 sm:w-auto snap-start"
                                            >
                                                <figure className="aspect-square relative overflow-hidden rounded-t-xl">
                                                    <img 
                                                        src={getImageUrl(item.album?.cover_image || "/placeholder-album.svg")} 
                                                        alt={item.album?.title} 
                                                        className="object-cover w-full h-full" 
                                                    />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="badge badge-primary badge-sm">{item.format?.name || 'Vinyl'}</span>
                                                    </div>
                                                </figure>
                                                <div className="card-body p-2 gap-0.5">
                                                    <h3 className="card-title text-xs leading-tight truncate block" title={item.album?.title}>
                                                        {item.album?.title}
                                                    </h3>
                                                    <p className="text-[10px] opacity-70 truncate block">{item.album?.artist}</p>
                                                    <p className="text-[9px] opacity-50 mt-0.5">
                                                        {new Date(item.addedAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-base-content/50 italic mt-2">
                                        {t('discover.noLatestAlbums', 'No recent additions.')}
                                    </p>
                                )}
                            </div>
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

