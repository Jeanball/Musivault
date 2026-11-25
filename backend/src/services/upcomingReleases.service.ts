/**
 * Fetching upcoming releases from MusicBrainz into the `UpcomingRelease`
 * collection, one style at a time. Shared by the weekly task and by the
 * "fetch right away" path used when a member follows a new style.
 *
 * MusicBrainz allows about one request per second, so everything that talks to
 * it goes through `runExclusive`, which runs one job at a time.
 */

import UpcomingRelease from '../models/UpcomingRelease';
import { logger } from '../config/logger.config';
import {
  fetchReleaseGroupsForStyle,
  buildCoverArtUrl,
  delay,
  normalizeStyle,
  MB_RATE_LIMIT_MS,
} from './musicbrainz.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A style fetched within this long ago is not fetched again on demand. */
export const RECENT_FETCH_MS = 7 * DAY_MS;
/** Following several styles in a row becomes one batch after this much quiet. */
export const FOLLOW_DEBOUNCE_MS = 3000;

/** The date window shown on Discover: 14 days back to 60 days ahead, "YYYY-MM-DD". */
export function upcomingWindow(now = new Date()): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: new Date(now.getTime() - 14 * DAY_MS).toISOString().slice(0, 10),
    dateTo: new Date(now.getTime() + 60 * DAY_MS).toISOString().slice(0, 10),
  };
}

// ===== Serialising MusicBrainz access =====

let tail: Promise<unknown> = Promise.resolve();

/** Run `job` after every job queued before it has finished, whether those succeeded or not. */
export function runExclusive<T>(job: () => Promise<T>): Promise<T> {
  const result = tail.then(job, job);
  tail = result.catch(() => undefined);
  return result;
}

// ===== Fetching one style =====

/** When each style was last fetched by this process, including searches that found nothing. */
const lastFetchedAt = new Map<string, number>();

/**
 * Search one style (lowercase) inside `window` and upsert the Album/EP release
 * groups with a day or month date. Returns the mbids it stored.
 * Callers are responsible for holding `runExclusive` and for the rate limit
 * between styles.
 */
export async function refreshStyle(
  style: string,
  window: { dateFrom: string; dateTo: string },
  onProgress?: (pass: number, maxPasses: number, current: number, total: number) => void
): Promise<string[]> {
  const releaseGroups = (await fetchReleaseGroupsForStyle(style, window.dateFrom, window.dateTo, onProgress)).filter(
    (rg) => rg.datePrecision !== 'year' && (rg.primaryType === 'Album' || rg.primaryType === 'EP')
  );

  for (const rg of releaseGroups) {
    await UpcomingRelease.findOneAndUpdate(
      { mbid: rg.mbid, style },
      {
        mbid: rg.mbid,
        title: rg.title,
        artist: rg.artist,
        style,
        firstReleaseDate: rg.firstReleaseDate,
        datePrecision: rg.datePrecision,
        primaryType: rg.primaryType,
        secondaryTypes: rg.secondaryTypes,
        coverArtUrl: buildCoverArtUrl(rg.mbid),
        fetchedAt: new Date(),
      },
      { upsert: true, new: true }
    );
  }

  lastFetchedAt.set(style, Date.now());
  return releaseGroups.map((rg) => rg.mbid);
}

// ===== Fetching right after a follow =====

const pending = new Set<string>();
let inFlight: string | null = null;
let timer: NodeJS.Timeout | null = null;

async function fetchedRecently(style: string): Promise<boolean> {
  const since = Date.now() - RECENT_FETCH_MS;
  if ((lastFetchedAt.get(style) ?? 0) > since) return true;
  return !!(await UpcomingRelease.exists({ style, fetchedAt: { $gt: new Date(since) } }));
}

async function drain(): Promise<void> {
  while (pending.size > 0) {
    const style = pending.values().next().value as string;
    pending.delete(style);

    try {
      // Checked inside the lock: the weekly task may have fetched it while we waited.
      await runExclusive(async () => {
        if (await fetchedRecently(style)) return;
        inFlight = style;
        try {
          const stored = await refreshStyle(style, upcomingWindow());
          logger.info(`[UpcomingReleases] Fetched followed style "${style}": ${stored.length} releases`);
        } finally {
          inFlight = null;
        }
        await delay(MB_RATE_LIMIT_MS);
      });
    } catch (err) {
      logger.warn({ err, style }, 'Failed to fetch a followed style, the weekly task will retry it');
    }
  }
}

/**
 * Fetch newly followed styles without waiting for the weekly task. Styles are
 * debounced into one batch, skipped when already queued, in flight or fetched
 * within RECENT_FETCH_MS, and fetched through `runExclusive`, so a flood of
 * follows cannot exceed MusicBrainz's rate limit. Returns immediately; failures
 * are logged, never thrown.
 */
export function queueStyleFetch(styles: string[]): void {
  for (const raw of styles) {
    const style = normalizeStyle(raw);
    if (style && style !== inFlight) pending.add(style);
  }
  if (pending.size === 0) return;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void drain();
  }, FOLLOW_DEBOUNCE_MS);
}
