import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Users, Music, Mic, Lock, Ticket, AlertCircle, CalendarClock, History, Store } from 'lucide-react';
import PublicAlbumModal from '../components/Modal/PublicAlbumModal';
import PublicUserCard from '../components/Discover/PublicUserCard';
import UpcomingReleaseCard from '../components/Discover/UpcomingReleaseCard';
import PreferredGenresDropdown from '../components/Discover/PreferredGenresDropdown';
import RecordShopCard from '../components/Discover/RecordShopCard';
import RecordShopCardSkeleton from '../components/Discover/RecordShopCardSkeleton';
import LocationControls from '../components/Discover/LocationControls';
import RadiusSlider from '../components/Discover/RadiusSlider';
import OsmAttribution from '../components/Discover/OsmAttribution';
import { useUserLocation } from '../hooks/useUserLocation';
import { useDebounce } from '../hooks/useDebounce';
import type { CollectionItem } from '../types/collection.types';
import type { PublicUser } from '../types/public.types';
import type { UpcomingRelease, RecordShop } from '../types/discover.types';
import { getPublicUsers } from '../api/public';
import { getUpcomingReleases, splitReleasesByToday, getRecordShops } from '../api/discover';
import { getPreferences, updatePreferences } from '../api/preferences';

/** Shops shown in the Discover preview; the full list lives on /app/discover/shops. */
const PREVIEW_SHOP_COUNT = 6;

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

    const { location, status: locationStatus, error: locationError, isRequestingPrecise, requestBrowserLocation, setManualLocation } = useUserLocation();
    const [shops, setShops] = useState<RecordShop[]>([]);
    // Starts true: the location resolves first, and a false here would flash
    // the empty state for a frame before the fetch effect gets to run.
    const [isShopsLoading, setIsShopsLoading] = useState(true);
    const [shopsError, setShopsError] = useState<string | null>(null);
    const [shopRadiusKm, setShopRadiusKm] = useState(25);
    const debouncedShopRadiusKm = useDebounce(shopRadiusKm, 400);

    useEffect(() => {
        getPreferences()
            .then((preferences) => setShopRadiusKm(preferences.discoverShopRadiusKm ?? 25))
            .catch(() => { /* the 25 km default is fine if preferences are unreachable */ });
    }, []);

    useEffect(() => {
        if (!location) return;

        let active = true;
        setIsShopsLoading(true);
        getRecordShops(location.lat, location.lon, debouncedShopRadiusKm)
            .then((found) => {
                if (!active) return;
                setShops(found);
                setShopsError(null);
            })
            .catch((err) => {
                if (!active) return;
                console.error('Failed to fetch record shops:', err);
                setShopsError(t('discover.failedLoadShops'));
            })
            .finally(() => {
                if (active) setIsShopsLoading(false);
            });

        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location, debouncedShopRadiusKm]);

    const persistShopRadius = (value: number) => {
        updatePreferences({ discoverShopRadiusKm: value }).catch((err) => {
            console.error('Failed to persist shop radius:', err);
        });
    };

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

            {/* Section 3: Record Shops Near You */}
            <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Store size={24} />
                        {t('discover.recordShopsNearYou')}
                    </h2>
                    {shops.length > 0 && (
                        <Link to="/app/discover/shops" className="btn btn-outline btn-sm">
                            {shops.length > PREVIEW_SHOP_COUNT
                                ? t('discover.viewAllShopsCount', { count: shops.length })
                                : t('discover.viewAllShops')}
                        </Link>
                    )}
                </div>

                <p className="text-base-content/70 text-sm mb-4">{t('discover.recordShopsSubtitle')}</p>

                {location && (
                    <div className="mb-4 space-y-3">
                        <LocationControls
                            location={location}
                            error={locationError}
                            isRequestingPrecise={isRequestingPrecise}
                            onRequestPrecise={requestBrowserLocation}
                            onManualLocation={setManualLocation}
                            // Once the precise attempt has failed, entering a city
                            // is the only way forward — don't make the user go
                            // hunting for it on the full page.
                            showManualSearch={locationError !== null}
                        />
                        <RadiusSlider
                            value={shopRadiusKm}
                            onChange={setShopRadiusKm}
                            onCommit={persistShopRadius}
                        />
                    </div>
                )}

                {/* Skeletons on every fetch, not just the first: changing the
                    location otherwise left the previous city's shops on screen
                    with nothing to show the new ones were being looked up. */}
                {locationStatus === 'resolving' || (location && isShopsLoading) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                        <RecordShopCardSkeleton count={PREVIEW_SHOP_COUNT} />
                    </div>
                ) : shopsError ? (
                    <div className="alert alert-error">
                        <AlertCircle className="shrink-0 h-6 w-6" />
                        <span>{shopsError}</span>
                    </div>
                ) : !location ? (
                    /* No position at all — the IP guess failed or was refused by the provider. */
                    <div className="bg-base-200 rounded-xl p-8 text-center border-2 border-dashed border-base-300">
                        <div className="flex justify-center mb-4">
                            <Store size={48} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{t('discover.findShopsNearYou')}</h3>
                        <p className="text-base-content/60 max-w-md mx-auto text-sm md:text-base mb-4">
                            {t('discover.locationNeeded')}
                        </p>
                        <LocationControls
                            location={null}
                            error={locationError}
                            isRequestingPrecise={isRequestingPrecise}
                            onRequestPrecise={requestBrowserLocation}
                            onManualLocation={setManualLocation}
                            showManualSearch
                        />
                    </div>
                ) : shops.length === 0 ? (
                    <div className="bg-base-200 rounded-xl p-8 text-center border-2 border-dashed border-base-300">
                        <div className="flex justify-center mb-4">
                            <Store size={48} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                            {t('discover.noShopsInRadius', { radius: shopRadiusKm })}
                        </h3>
                        <p className="text-base-content/60 max-w-md mx-auto text-sm md:text-base mb-4">
                            {t('discover.noShopsHint')}
                        </p>
                        <Link to="/app/discover/shops" className="btn btn-primary btn-sm">
                            {t('discover.widenSearch')}
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                            {shops.slice(0, PREVIEW_SHOP_COUNT).map((shop) => (
                                <RecordShopCard key={`${shop.osmType}-${shop.osmId}`} shop={shop} />
                            ))}
                        </div>
                        {/* The grid is capped, so say so and offer the way out —
                            the header button alone is easy to miss after scrolling. */}
                        {shops.length > PREVIEW_SHOP_COUNT && (
                            <div className="mt-4 text-center">
                                <Link to="/app/discover/shops" className="btn btn-primary btn-sm">
                                    {t('discover.seeRemainingShops', { count: shops.length - PREVIEW_SHOP_COUNT })}
                                </Link>
                            </div>
                        )}
                        <OsmAttribution />
                    </>
                )}
            </section>

            {/* Section 4: Shows Near You - Coming Soon */}
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

