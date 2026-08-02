import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Users, Music, Mic, Lock, Ticket, AlertCircle, CalendarClock, History } from 'lucide-react';
import PublicAlbumModal from '../components/Modal/PublicAlbumModal';
import PublicUserCard from '../components/Discover/PublicUserCard';
import UpcomingReleaseCard from '../components/Discover/UpcomingReleaseCard';
import PreferredGenresDropdown from '../components/Discover/PreferredGenresDropdown';
import type { CollectionItem } from '../types/collection.types';
import type { PublicUser } from '../types/public.types';
import type { UpcomingRelease } from '../types/discover.types';
import { getPublicUsers } from '../api/public';
import { getUpcomingReleases, splitReleasesByToday } from '../api/discover';

const DiscoverPage: React.FC = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState<PublicUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedAlbum, setSelectedAlbum] = useState<CollectionItem | null>(null);
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

    const [upcomingReleases, setUpcomingReleases] = useState<UpcomingRelease[]>([]);
    const [isUpcomingLoading, setIsUpcomingLoading] = useState(true);
    const [upcomingError, setUpcomingError] = useState<string | null>(null);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        const fetchPublicUsers = async () => {
            try {
                setUsers(await getPublicUsers());
            } catch (err) {
                console.error('Failed to fetch public users:', err);
                setError(t('discover.failedLoadCollections'));
            } finally {
                setIsLoading(false);
            }
        };

        fetchPublicUsers();
    }, []);

    const fetchUpcomingReleases = async () => {
        try {
            setUpcomingReleases(await getUpcomingReleases());
            setUpcomingError(null);
        } catch (err) {
            console.error('Failed to fetch upcoming releases:', err);
            setUpcomingError(t('discover.failedLoadUpcoming'));
        } finally {
            setIsUpcomingLoading(false);
        }
    };

    useEffect(() => {
        fetchUpcomingReleases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const upcomingSummary = useMemo(() => splitReleasesByToday(upcomingReleases), [upcomingReleases]);

    const toggleUserExpanded = (publicShareId: string) => {
        setExpandedUsers((prev) => {
            const next = new Set(prev);
            if (next.has(publicShareId)) {
                next.delete(publicShareId);
            } else {
                next.add(publicShareId);
            }
            return next;
        });
    };



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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                        {users.map((user) => (
                            <PublicUserCard
                                key={user.publicShareId}
                                user={user}
                                isExpanded={expandedUsers.has(user.publicShareId)}
                                onToggleExpand={() => toggleUserExpanded(user.publicShareId)}
                                onSelectAlbum={setSelectedAlbum}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Section 2: On Your Radar — recent + upcoming summary; full list on the dedicated page */}
            <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Music size={24} />
                        {t('discover.onYourRadar')}
                    </h2>
                    <div className="flex items-center gap-2">
                        <PreferredGenresDropdown onSaved={fetchUpcomingReleases} />
                        {upcomingReleases.length > 0 && (
                            <Link to="/app/discover/releases" className="btn btn-outline btn-sm">
                                {t('discover.viewAllReleases')}
                            </Link>
                        )}
                    </div>
                </div>

                {isUpcomingLoading ? (
                    <div className="flex justify-center items-center h-32">
                        <span className="loading loading-spinner loading-lg text-primary"></span>
                    </div>
                ) : upcomingError ? (
                    <div className="alert alert-error">
                        <AlertCircle className="shrink-0 h-6 w-6" />
                        <span>{upcomingError}</span>
                    </div>
                ) : upcomingReleases.length === 0 ? (
                    <div className="bg-base-200 rounded-xl p-8 text-center border-2 border-dashed border-base-300">
                        <div className="flex justify-center mb-4">
                            <Music size={48} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{t('discover.newMusicFromArtists')}</h3>
                        <p className="text-base-content/60 max-w-md mx-auto text-sm md:text-base">
                            {t('discover.noUpcomingReleases')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {upcomingSummary.upcoming.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-3 text-base-content/70 flex items-center gap-2">
                                    <CalendarClock size={16} />
                                    {t('discover.upcomingSection')}
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {upcomingSummary.upcoming.slice(0, 5).map((release) => (
                                        <UpcomingReleaseCard key={release.mbid} release={release} />
                                    ))}
                                </div>
                            </div>
                        )}
                        {upcomingSummary.recent.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-3 text-base-content/70 flex items-center gap-2">
                                    <History size={16} />
                                    {t('discover.recentSection')}
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {upcomingSummary.recent.slice(0, 5).map((release) => (
                                        <UpcomingReleaseCard key={release.mbid} release={release} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
            <PublicAlbumModal
                item={selectedAlbum}
                onClose={() => setSelectedAlbum(null)}
            />
        </div>
    );
};

export default DiscoverPage;

