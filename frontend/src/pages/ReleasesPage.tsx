import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Music, CalendarClock, History, Search, AlertCircle } from 'lucide-react';
import BackButton from '../components/Common/BackButton';
import UpcomingReleaseCard from '../components/Discover/UpcomingReleaseCard';
import ReleaseWeekHeader from '../components/Discover/ReleaseWeekHeader';
import PreferredGenresDropdown from '../components/Discover/PreferredGenresDropdown';
import type { UpcomingRelease } from '../types/discover.types';
import { getUpcomingReleases, groupReleasesByWeek, splitReleasesByToday } from '../api/discover';

type ReleaseTab = 'upcoming' | 'recent';

const ReleasesPage: React.FC = () => {
    const { t } = useTranslation();
    const [releases, setReleases] = useState<UpcomingRelease[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [styleFilter, setStyleFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<ReleaseTab>('upcoming');

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const fetchReleases = useCallback(async (showSpinner: boolean) => {
        if (showSpinner) setIsLoading(true);
        try {
            setReleases(await getUpcomingReleases());
            setError(null);
        } catch (err) {
            console.error('Failed to fetch upcoming releases:', err);
            setError(t('discover.failedLoadUpcoming'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchReleases(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const styleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const r of releases) {
            for (const s of r.matchedStyles) {
                counts[s] = (counts[s] || 0) + 1;
            }
        }
        return counts;
    }, [releases]);

    const availableStyles = useMemo(() => Object.keys(styleCounts).sort(), [styleCounts]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        return releases.filter((r) => {
            if (styleFilter !== 'all' && !r.matchedStyles.includes(styleFilter)) return false;
            if (!q) return true;
            return (
                r.title.toLowerCase().includes(q) ||
                r.artist.toLowerCase().includes(q) ||
                r.matchedStyles.some((s) => s.toLowerCase().includes(q))
            );
        });
    }, [releases, query, styleFilter]);

    const { recent, upcoming } = useMemo(() => splitReleasesByToday(filtered), [filtered]);
    const visible = activeTab === 'upcoming' ? upcoming : recent;

    // Upcoming reads forwards in time, recent backwards from today.
    const groups = useMemo(
        () => groupReleasesByWeek(visible, activeTab === 'upcoming' ? 'asc' : 'desc'),
        [visible, activeTab]
    );

    return (
        <div className="max-w-6xl mx-auto">
            <BackButton />

            <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                    <Music size={32} />
                    {t('discover.releasesPageTitle')}
                </h1>
                <p className="text-base-content/70">{t('discover.releasesPageSubtitle')}</p>
            </div>

            {/* Tabs + search */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="tabs tabs-boxed bg-base-200 inline-flex max-w-full overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('upcoming')}
                        className={`tab h-auto min-h-8 py-1.5 px-3 gap-2 flex-nowrap whitespace-nowrap ${activeTab === 'upcoming' ? 'tab-active' : ''}`}
                    >
                        <CalendarClock size={16} className="shrink-0" />
                        {t('discover.upcomingSection')}
                        <span className="badge badge-sm badge-neutral">{upcoming.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('recent')}
                        className={`tab h-auto min-h-8 py-1.5 px-3 gap-2 flex-nowrap whitespace-nowrap ${activeTab === 'recent' ? 'tab-active' : ''}`}
                    >
                        <History size={16} className="shrink-0" />
                        {t('discover.recentSection')}
                        <span className="badge badge-sm badge-neutral">{recent.length}</span>
                    </button>
                </div>

                <label className="input input-bordered flex items-center gap-2 flex-1 min-w-52 max-w-md">
                    <Search size={18} className="opacity-60" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('discover.searchReleases')}
                        className="grow"
                    />
                </label>

                <select
                    className="select select-bordered w-full sm:w-auto"
                    value={styleFilter}
                    onChange={(e) => setStyleFilter(e.target.value)}
                >
                    <option value="all">{t('discover.allStyles')}</option>
                    {availableStyles.map((style) => (
                        <option key={style} value={style}>{style} ({styleCounts[style]})</option>
                    ))}
                </select>

                <PreferredGenresDropdown onSaved={() => fetchReleases(false)} />
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-32">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
            ) : error ? (
                <div className="alert alert-error">
                    <AlertCircle className="shrink-0 h-6 w-6" />
                    <span>{error}</span>
                </div>
            ) : visible.length === 0 ? (
                <div className="bg-base-200 rounded-xl p-8 text-center border-2 border-dashed border-base-300">
                    <div className="flex justify-center mb-4">
                        <Music size={48} />
                    </div>
                    <p className="text-base-content/60">
                        {query
                            ? t('discover.noReleasesMatchSearch', { query })
                            : t('discover.noReleasesInSection')}
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {groups.map((group) => (
                        <section key={group.key}>
                            <ReleaseWeekHeader group={group} />
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {group.releases.map((release) => (
                                    <UpcomingReleaseCard key={release.mbid} release={release} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReleasesPage;
