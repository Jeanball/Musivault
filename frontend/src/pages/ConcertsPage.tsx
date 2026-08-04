import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Search, AlertCircle } from 'lucide-react';
import BackButton from '../components/Common/BackButton';
import CardSkeleton from '../components/Common/CardSkeleton';
import EmptyState from '../components/Common/EmptyState';
import ConcertCard from '../components/Discover/ConcertCard';
import NearbyControls from '../components/Discover/NearbyControls';
import TicketmasterAttribution from '../components/Discover/TicketmasterAttribution';
import { RESULTS_GRID_CLASS } from '../components/Discover/constants';
import { useNearby, useNearbySearch } from '../hooks/useNearbySearch';
import type { Concert } from '../types/discover.types';
import { getConcerts } from '../api/discover';
import { foldForSearch } from '../utils/search';

/** Windows offered by the date filter; 0 means "everything Ticketmaster lists". */
const DAY_WINDOWS = [30, 90, 180, 365, 0] as const;

type ConcertScope = 'for-you' | 'all';

const ConcertsPage: React.FC = () => {
    const { t } = useTranslation();
    const nearby = useNearby();

    const [scope, setScope] = useState<ConcertScope>('for-you');
    const [days, setDays] = useState<number>(0);
    const [genre, setGenre] = useState('');
    const [query, setQuery] = useState('');

    // Both reach the server, so they belong in the search deps rather than in a
    // client-side filter over the results.
    const fetcher = useCallback(
        // 0 is "no window": the parameter is dropped and the server returns
        // everything it has, however far out that goes.
        (lat: number, lon: number, radiusKm: number) => getConcerts(lat, lon, radiusKm, days || undefined, scope),
        [days, scope]
    );
    const { items: concerts, isLoading, error, unavailable } = useNearbySearch<Concert>(
        nearby,
        fetcher,
        'discover.failedLoadConcerts',
        [days, scope]
    );

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    /** Only the genres actually present, so the filter can't offer a dead end. */
    const availableGenres = useMemo(
        () => Array.from(new Set(concerts.map((c) => c.genre).filter(Boolean) as string[])).sort(),
        [concerts]
    );

    const filtered = useMemo(() => {
        // Folded rather than lowercased: an act is searched for the way the user
        // spells it, not the way Ticketmaster happens to have keyed it in.
        const q = foldForSearch(query);
        return concerts.filter((concert) => {
            if (genre && concert.genre !== genre) return false;
            if (!q) return true;
            return foldForSearch(concert.name).includes(q) ||
                foldForSearch(concert.venueName).includes(q) ||
                foldForSearch(concert.venueCity ?? '').includes(q) ||
                // The whole bill, so a support slot finds its show too.
                concert.attractions.some((attraction) => foldForSearch(attraction).includes(q));
        });
    }, [concerts, query, genre]);

    return (
        <div className="max-w-6xl mx-auto">
            <BackButton />

            <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                    <Mic size={32} />
                    {t('discover.concertsPageTitle')}
                </h1>
                <p className="text-base-content/70">{t('discover.concertsPageSubtitle')}</p>
            </div>

            <div className="mb-8">
                <NearbyControls nearby={nearby}>
                    <label className="input flex items-center gap-2 flex-1 min-w-52 max-w-md">
                        <Search size={18} className="opacity-60" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('discover.searchConcerts')}
                            className="grow"
                        />
                    </label>

                    <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="select w-auto"
                        aria-label={t('discover.allGenres')}
                    >
                        <option value="">{t('discover.allGenres')}</option>
                        {availableGenres.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>

                    <select
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                        className="select w-auto"
                        aria-label={t('discover.nextDays', { count: days })}
                    >
                        {DAY_WINDOWS.map((window) => (
                            <option key={window} value={window}>
                                {window === 0 ? t('discover.allDates') : t('discover.nextDays', { count: window })}
                            </option>
                        ))}
                    </select>
                </NearbyControls>
            </div>

            <div role="tablist" className="tabs tabs-box mb-6 w-fit">
                <button
                    role="tab"
                    className={`tab ${scope === 'for-you' ? 'tab-active' : ''}`}
                    onClick={() => setScope('for-you')}
                >
                    {t('discover.forYouTab')}
                </button>
                <button
                    role="tab"
                    className={`tab ${scope === 'all' ? 'tab-active' : ''}`}
                    onClick={() => setScope('all')}
                >
                    {t('discover.allConcertsTab')}
                </button>
            </div>

            {/* Also covers radius, window and scope changes, which all refetch. */}
            {nearby.status === 'resolving' || (nearby.location && isLoading) ? (
                <div className={RESULTS_GRID_CLASS}>
                    <CardSkeleton count={9} variant="media" />
                </div>
            ) : unavailable ? (
                <EmptyState icon={Mic} description={t('discover.concertsNotConfigured')} />
            ) : error ? (
                <div className="alert alert-error">
                    <AlertCircle className="shrink-0 h-6 w-6" />
                    <span>{error}</span>
                </div>
            ) : !nearby.location ? (
                <EmptyState
                    icon={Mic}
                    title={t('discover.findConcertsNearYou')}
                    description={t('discover.locationNeeded')}
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={Mic}
                    description={query
                        ? t('discover.noConcertsMatchSearch', { query })
                        : t('discover.noConcertsInRadius', { radius: nearby.radiusKm })}
                >
                    {!query ? (
                        <p className="text-base-content/60 text-sm max-w-md mx-auto">
                            {t('discover.noConcertsHint')}
                        </p>
                    ) : scope === 'for-you' && (
                        // The search only ever sees what the server sent, and in
                        // this tab that is the collection's own shows — an act
                        // the user owns nothing by can only be found in All shows.
                        <div className="max-w-md mx-auto">
                            <p className="text-base-content/60 text-sm">{t('discover.searchForYouHint')}</p>
                            <button className="btn btn-sm btn-outline mt-3" onClick={() => setScope('all')}>
                                {t('discover.searchAllShows')}
                            </button>
                        </div>
                    )}
                </EmptyState>
            ) : (
                <>
                    <p className="text-sm text-base-content/60 mb-3">
                        {t('discover.concertsFound', { count: filtered.length, radius: nearby.radiusKm })}
                    </p>
                    <div className={RESULTS_GRID_CLASS}>
                        {filtered.map((concert) => (
                            <ConcertCard key={concert.tmId} concert={concert} />
                        ))}
                    </div>
                    <TicketmasterAttribution />
                </>
            )}
        </div>
    );
};

export default ConcertsPage;
