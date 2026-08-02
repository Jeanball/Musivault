import { client } from './client';
import type { UpcomingRelease } from '../types/discover.types';

export async function getUpcomingReleases(): Promise<UpcomingRelease[]> {
    const { data } = await client.get<UpcomingRelease[]>('/discover/upcoming-releases');
    return data;
}

/** Month-precision dates ("2026-08") compare as their first day. */
const comparableDate = (date: string): string =>
    date.length === 7 ? `${date}-01` : date;

/**
 * Split releases into recent (before today, most recent first) and
 * upcoming (today or later, soonest first).
 */
export function splitReleasesByToday(releases: UpcomingRelease[]): {
    recent: UpcomingRelease[];
    upcoming: UpcomingRelease[];
} {
    const today = new Date().toISOString().slice(0, 10);
    const recent: UpcomingRelease[] = [];
    const upcoming: UpcomingRelease[] = [];

    for (const release of releases) {
        (comparableDate(release.firstReleaseDate) < today ? recent : upcoming).push(release);
    }

    recent.sort((a, b) => comparableDate(b.firstReleaseDate).localeCompare(comparableDate(a.firstReleaseDate)));
    upcoming.sort((a, b) => comparableDate(a.firstReleaseDate).localeCompare(comparableDate(b.firstReleaseDate)));

    return { recent, upcoming };
}
