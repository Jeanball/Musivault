import { client } from './client';
import type { UpcomingRelease, RecordShop, ApproximateLocation, GeocodeResult } from '../types/discover.types';
import { parseLocalDate, startOfWeek } from '../utils/date';

export async function getUpcomingReleases(): Promise<UpcomingRelease[]> {
    const { data } = await client.get<UpcomingRelease[]>('/discover/upcoming-releases');
    return data;
}

/** Position guessed from the request IP — no browser permission involved. */
export async function getApproximateLocation(): Promise<ApproximateLocation> {
    const { data } = await client.get<ApproximateLocation>('/discover/location');
    return data;
}

export async function getRecordShops(lat: number, lon: number, radiusKm: number): Promise<RecordShop[]> {
    const { data } = await client.get<RecordShop[]>('/discover/record-shops', {
        params: { lat, lon, radius: radiusKm },
    });
    return data;
}

/** Free-text place search, proxied through the backend (Nominatim needs a User-Agent). */
export async function geocodePlace(query: string): Promise<GeocodeResult[]> {
    const { data } = await client.get<GeocodeResult[]>('/discover/geocode', { params: { q: query } });
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

/**
 * A chronological section of the releases list: either an ISO week, or — for
 * releases MusicBrainz only dates to the month — a whole-month bucket.
 */
export interface ReleaseWeekGroup {
    key: string;
    kind: 'week' | 'month';
    /** Sorts the group among the others; also the week start for `kind: 'week'`. */
    sortDate: Date;
    /** Monday of the week, for `kind: 'week'`. */
    weekStart?: Date;
    /** "YYYY-MM", for `kind: 'month'`. */
    month?: string;
    releases: UpcomingRelease[];
}

const localeCompareByDate = (a: UpcomingRelease, b: UpcomingRelease): number =>
    comparableDate(a.firstReleaseDate).localeCompare(comparableDate(b.firstReleaseDate));

/**
 * Bucket releases into weeks (Monday-based). Month-precision releases can't be
 * placed in a week, so they get a per-month bucket sorted at the end of that
 * month — after every week it contains.
 */
export function groupReleasesByWeek(
    releases: UpcomingRelease[],
    direction: 'asc' | 'desc'
): ReleaseWeekGroup[] {
    const groups = new Map<string, ReleaseWeekGroup>();

    for (const release of releases) {
        let group: ReleaseWeekGroup;

        if (release.datePrecision === 'month') {
            const month = release.firstReleaseDate.slice(0, 7);
            const [year, monthNumber] = month.split('-').map(Number);
            group = groups.get(`month:${month}`) ?? {
                key: `month:${month}`,
                kind: 'month',
                // Last day of the month, so the bucket trails that month's weeks.
                sortDate: new Date(year, monthNumber, 0),
                month,
                releases: [],
            };
        } else {
            const weekStart = startOfWeek(parseLocalDate(release.firstReleaseDate));
            const key = `week:${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
            group = groups.get(key) ?? {
                key,
                kind: 'week',
                sortDate: weekStart,
                weekStart,
                releases: [],
            };
        }

        group.releases.push(release);
        groups.set(group.key, group);
    }

    const sign = direction === 'asc' ? 1 : -1;
    const sorted = Array.from(groups.values()).sort(
        (a, b) => sign * (a.sortDate.getTime() - b.sortDate.getTime())
    );
    for (const group of sorted) {
        group.releases.sort((a, b) => sign * localeCompareByDate(a, b));
    }
    return sorted;
}
