import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Users, Music, Mic, Lock, AlertCircle, CalendarClock, History, Store, MapPinned } from 'lucide-react';
import PublicAlbumModal from '../components/Modal/PublicAlbumModal';
import PublicUserCard from '../components/Discover/PublicUserCard';
import UpcomingReleaseCard from '../components/Discover/UpcomingReleaseCard';
import PreferredGenresDropdown from '../components/Discover/PreferredGenresDropdown';
import RecordShopCard from '../components/Discover/RecordShopCard';
import ConcertCard from '../components/Discover/ConcertCard';
import NearbyControls from '../components/Discover/NearbyControls';
import OsmAttribution from '../components/Discover/OsmAttribution';
import TicketmasterAttribution from '../components/Discover/TicketmasterAttribution';
import CardSkeleton from '../components/Common/CardSkeleton';
import EmptyState from '../components/Common/EmptyState';
import { RESULTS_GRID_CLASS, PREVIEW_COUNT } from '../components/Discover/constants';
import { useNearby, useNearbySearch } from '../hooks/useNearbySearch';
import type { CollectionItem } from '../types/collection.types';
import type { PublicUser } from '../types/public.types';
import type { UpcomingRelease, RecordShop, Concert } from '../types/discover.types';
import { getPublicUsers } from '../api/public';
import { getUpcomingReleases, splitReleasesByToday, getRecordShops, getConcerts } from '../api/discover';

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

    // One position and one radius for every "near you" section below.
    const nearby = useNearby();
    const { items: shops, isLoading: isShopsLoading, error: shopsError } =
        useNearbySearch<RecordShop>(nearby, getRecordShops, 'discover.failedLoadShops');
    const { items: concerts, isLoading: isConcertsLoading, error: concertsError } =
        useNearbySearch<Concert>(nearby, getConcerts, 'discover.failedLoadConcerts');

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
                    <EmptyState
                        icon={Lock}
                        title={t('discover.noPublicCollections')}
                        description={t('discover.beTheFirst')}
                    >
                        <Link to="/app/settings" className="btn btn-primary btn-sm">{t('discover.goToSettings')}</Link>
                    </EmptyState>
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
                    <EmptyState
                        icon={Music}
                        title={t('discover.newMusicFromArtists')}
                        description={t('discover.noUpcomingReleases')}
                    />
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

            {/* Sections 3 & 4: everything "near you", driven by one set of controls */}
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 mb-4">
                        <MapPinned size={24} />
                        {t('discover.nearYou')}
                    </h2>
                    <NearbyControls
                        nearby={nearby}
                        // Once the precise attempt has failed, entering a city is the
                        // only way forward — don't make the user go hunting for it.
                        showManualSearch={!nearby.location || nearby.error !== null}
                    />
                </div>

                {/* Section 3: Record Shops Near You */}
                <section>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Store size={22} />
                            {t('discover.recordShopsNearYou')}
                        </h3>
                        {shops.length > 0 && (
                            <Link to="/app/discover/shops" className="btn btn-outline btn-sm">
                                {shops.length > PREVIEW_COUNT
                                    ? t('discover.viewAllShopsCount', { count: shops.length })
                                    : t('discover.viewAllShops')}
                            </Link>
                        )}
                    </div>

                    <p className="text-base-content/70 text-sm mb-4">{t('discover.recordShopsSubtitle')}</p>

                    {/* Skeletons on every fetch, not just the first: changing the
                        location otherwise left the previous city's shops on screen
                        with nothing to show the new ones were being looked up. */}
                    {nearby.status === 'resolving' || (nearby.location && isShopsLoading) ? (
                        <div className={RESULTS_GRID_CLASS}>
                            <CardSkeleton count={PREVIEW_COUNT} />
                        </div>
                    ) : shopsError ? (
                        <div className="alert alert-error">
                            <AlertCircle className="shrink-0 h-6 w-6" />
                            <span>{shopsError}</span>
                        </div>
                    ) : !nearby.location ? (
                        /* No position at all — the IP guess failed or was refused by the provider. */
                        <EmptyState
                            icon={Store}
                            title={t('discover.findShopsNearYou')}
                            description={t('discover.locationNeeded')}
                        />
                    ) : shops.length === 0 ? (
                        <EmptyState
                            icon={Store}
                            title={t('discover.noShopsInRadius', { radius: nearby.radiusKm })}
                            description={t('discover.noShopsHint')}
                        >
                            <Link to="/app/discover/shops" className="btn btn-primary btn-sm">
                                {t('discover.widenSearch')}
                            </Link>
                        </EmptyState>
                    ) : (
                        <>
                            <div className={RESULTS_GRID_CLASS}>
                                {shops.slice(0, PREVIEW_COUNT).map((shop) => (
                                    <RecordShopCard key={`${shop.osmType}-${shop.osmId}`} shop={shop} />
                                ))}
                            </div>
                            {/* The grid is capped, so say so and offer the way out —
                                the header button alone is easy to miss after scrolling. */}
                            {shops.length > PREVIEW_COUNT && (
                                <div className="mt-4 text-center">
                                    <Link to="/app/discover/shops" className="btn btn-primary btn-sm">
                                        {t('discover.seeRemainingShops', { count: shops.length - PREVIEW_COUNT })}
                                    </Link>
                                </div>
                            )}
                            <OsmAttribution />
                        </>
                    )}
                </section>

                {/* Section 4: Shows Near You */}
                <section>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Mic size={22} />
                            {t('discover.showsNearYou')}
                        </h3>
                        {concerts.length > 0 && (
                            <Link to="/app/discover/concerts" className="btn btn-outline btn-sm">
                                {concerts.length > PREVIEW_COUNT
                                    ? t('discover.viewAllConcertsCount', { count: concerts.length })
                                    : t('discover.viewAllConcerts')}
                            </Link>
                        )}
                    </div>

                    <p className="text-base-content/70 text-sm mb-4">{t('discover.concertsSubtitle')}</p>

                    {nearby.status === 'resolving' || (nearby.location && isConcertsLoading) ? (
                        <div className={RESULTS_GRID_CLASS}>
                            <CardSkeleton count={PREVIEW_COUNT} variant="media" />
                        </div>
                    ) : concertsError ? (
                        <div className="alert alert-error">
                            <AlertCircle className="shrink-0 h-6 w-6" />
                            <span>{concertsError}</span>
                        </div>
                    ) : !nearby.location ? (
                        <EmptyState
                            icon={Mic}
                            title={t('discover.findConcertsNearYou')}
                            description={t('discover.locationNeeded')}
                        />
                    ) : concerts.length === 0 ? (
                        <EmptyState
                            icon={Mic}
                            title={t('discover.noConcertsInRadius', { radius: nearby.radiusKm })}
                            description={t('discover.noConcertsHint')}
                        >
                            <Link to="/app/discover/concerts" className="btn btn-primary btn-sm">
                                {t('discover.widenSearch')}
                            </Link>
                        </EmptyState>
                    ) : (
                        <>
                            <div className={RESULTS_GRID_CLASS}>
                                {concerts.slice(0, PREVIEW_COUNT).map((concert) => (
                                    <ConcertCard key={concert.tmId} concert={concert} />
                                ))}
                            </div>
                            {concerts.length > PREVIEW_COUNT && (
                                <div className="mt-4 text-center">
                                    <Link to="/app/discover/concerts" className="btn btn-primary btn-sm">
                                        {t('discover.seeRemainingConcerts', { count: concerts.length - PREVIEW_COUNT })}
                                    </Link>
                                </div>
                            )}
                            <TicketmasterAttribution />
                        </>
                    )}
                </section>
            </div>
            <PublicAlbumModal
                item={selectedAlbum}
                onClose={() => setSelectedAlbum(null)}
            />
        </div>
    );
};

export default DiscoverPage;

