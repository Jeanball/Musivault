/**
 * MusicBrainz API utilities for the "Upcoming Releases" discover feature.
 *
 * MusicBrainz is free, needs no API key, but requires a descriptive
 * User-Agent and enforces a ~1 req/sec rate limit. See:
 * https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
 */

import axios from 'axios';
import { logger } from '../config/logger.config';

// ===== Constants =====

export const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
export const MUSICBRAINZ_HEADERS = {
  'User-Agent': 'Musivault/1.0 (https://github.com/musivault)',
  'Accept': 'application/json',
};
export const MB_RATE_LIMIT_MS = 1100;
export const MB_PAGE_SIZE = 100;
export const MB_ARTIST_BATCH_SIZE = 10;

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const MB_MAX_RETRIES = 3;
const MB_RETRY_BACKOFF_MS = 3000;

/**
 * MusicBrainz occasionally answers with 503 ("server is currently busy") under
 * normal load, unrelated to our own rate limiting. Retry those with backoff
 * instead of failing the whole weekly sync over a transient blip.
 */
async function requestWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MB_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const retryable = status === 503 || status === 429 || !status;
      if (!retryable || attempt === MB_MAX_RETRIES) {
        throw error;
      }
      await delay(MB_RETRY_BACKOFF_MS * (attempt + 1));
    }
  }
  throw lastError;
}

// ===== Types =====

export type DatePrecision = 'day' | 'month' | 'year';

export interface MusicBrainzArtistCredit {
  artist: {
    id: string;
    name: string;
  };
}

export interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
  'artist-credit'?: MusicBrainzArtistCredit[];
}

interface ReleaseGroupSearchResponse {
  count: number;
  offset: number;
  'release-groups': MusicBrainzReleaseGroup[];
}

interface ArtistSearchResult {
  id: string;
  tags?: { name: string; count: number }[];
}

interface ArtistSearchResponse {
  artists: ArtistSearchResult[];
}

export interface ParsedReleaseGroup {
  mbid: string;
  title: string;
  artist: string;
  artistIds: string[];
  firstReleaseDate: string;
  datePrecision: DatePrecision;
  primaryType?: string;
  secondaryTypes: string[];
}

// ===== Helpers =====

/**
 * Determine date precision from a MusicBrainz first-release-date string
 * ("YYYY", "YYYY-MM", or "YYYY-MM-DD").
 */
export function parseDatePrecision(dateStr: string): DatePrecision {
  const segments = dateStr.split('-').length;
  if (segments >= 3) return 'day';
  if (segments === 2) return 'month';
  return 'year';
}

/**
 * Normalize a style/tag string for cross-vocabulary matching
 * (Discogs styles vs. MusicBrainz community tags).
 */
export function normalizeStyle(s: string): string {
  return s.toLowerCase().trim();
}

function escapeLuceneDate(date: string): string {
  // Dates are always YYYY-MM-DD here, no special chars to escape, but keep
  // the helper so callers don't need to think about it.
  return date;
}

// ===== Release groups =====

/**
 * All results of a date-range search share the same relevance score, and
 * MusicBrainz's search cluster does not order tied results consistently
 * between requests — so a single pagination pass both misses and duplicates
 * entries at page boundaries. Multiple passes merged by mbid converge on the
 * full set; stop early once a pass discovers nothing new.
 */
const MB_MAX_PAGINATION_PASSES = 3;

export type MBFetchProgress = (current: number, total: number) => void;

async function paginateReleaseGroupsOnce(
  query: string,
  resultsByMbid: Map<string, ParsedReleaseGroup>,
  onPage?: MBFetchProgress
): Promise<number> {
  let newCount = 0;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const response = await requestWithRetry(() =>
      axios.get<ReleaseGroupSearchResponse>(`${MUSICBRAINZ_BASE_URL}/release-group`, {
        headers: MUSICBRAINZ_HEADERS,
        params: {
          query,
          limit: MB_PAGE_SIZE,
          offset,
          fmt: 'json',
        },
      })
    );

    const data = response.data;
    total = data.count;

    for (const rg of data['release-groups'] || []) {
      if (resultsByMbid.has(rg.id)) continue;

      const firstReleaseDate = rg['first-release-date'];
      if (!firstReleaseDate) continue;

      const artistIds = (rg['artist-credit'] || [])
        .map((credit) => credit.artist?.id)
        .filter((id): id is string => !!id);

      if (artistIds.length === 0) continue;

      const artist = (rg['artist-credit'] || []).map((c) => c.artist.name).join(', ');

      resultsByMbid.set(rg.id, {
        mbid: rg.id,
        title: rg.title,
        artist,
        artistIds,
        firstReleaseDate,
        datePrecision: parseDatePrecision(firstReleaseDate),
        primaryType: rg['primary-type'],
        secondaryTypes: rg['secondary-types'] || [],
      });
      newCount++;
    }

    offset += MB_PAGE_SIZE;
    onPage?.(Math.min(offset, total), total);

    if (offset < total) {
      await delay(MB_RATE_LIMIT_MS);
    }
  }

  return newCount;
}

/**
 * Fetch all release-groups with a first-release-date inside [dateFrom, dateTo]
 * (inclusive, "YYYY-MM-DD"), paginating sequentially with rate-limit delays.
 * No genre/tag filter — release-group level tags are too sparse (see plan).
 */
export async function fetchReleaseGroupsInWindow(
  dateFrom: string,
  dateTo: string,
  onProgress?: (pass: number, maxPasses: number, current: number, total: number) => void
): Promise<ParsedReleaseGroup[]> {
  const query = `firstreleasedate:[${escapeLuceneDate(dateFrom)} TO ${escapeLuceneDate(dateTo)}]`;
  const resultsByMbid = new Map<string, ParsedReleaseGroup>();

  for (let pass = 1; pass <= MB_MAX_PAGINATION_PASSES; pass++) {
    const newCount = await paginateReleaseGroupsOnce(query, resultsByMbid, (current, total) =>
      onProgress?.(pass, MB_MAX_PAGINATION_PASSES, current, total)
    );
    logger.info(
      `[MusicBrainz] Release-group pass ${pass}: ${newCount} new, ${resultsByMbid.size} total unique`
    );
    if (pass > 1 && newCount === 0) break;
    if (pass < MB_MAX_PAGINATION_PASSES) {
      await delay(MB_RATE_LIMIT_MS);
    }
  }

  return Array.from(resultsByMbid.values());
}

// ===== Artist tags =====

/**
 * Fetch community tags for a batch of artist MBIDs (~10 at a time).
 * Uses the `tags` field, NOT `genres` — the structured `genres` taxonomy is
 * empty in practice for most artists, while `tags` is well populated.
 */
export async function fetchArtistTagsBatch(
  artistIds: string[],
  onProgress?: MBFetchProgress
): Promise<Map<string, string[]>> {
  const tagsByArtist = new Map<string, string[]>();
  if (artistIds.length === 0) return tagsByArtist;

  const batches: string[][] = [];
  for (let i = 0; i < artistIds.length; i += MB_ARTIST_BATCH_SIZE) {
    batches.push(artistIds.slice(i, i + MB_ARTIST_BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const query = batch.map((id) => `arid:${id}`).join(' OR ');

    try {
      const response = await requestWithRetry(() =>
        axios.get<ArtistSearchResponse>(`${MUSICBRAINZ_BASE_URL}/artist`, {
          headers: MUSICBRAINZ_HEADERS,
          params: {
            query,
            inc: 'genres',
            limit: MB_ARTIST_BATCH_SIZE,
            fmt: 'json',
          },
        })
      );

      for (const artist of response.data.artists || []) {
        const tags = (artist.tags || []).map((t) => normalizeStyle(t.name));
        tagsByArtist.set(artist.id, tags);
      }
    } catch (error) {
      logger.warn({ err: error, batch }, 'Failed to fetch MusicBrainz artist tags batch, skipping');
    }

    onProgress?.(i + 1, batches.length);

    if (i < batches.length - 1) {
      await delay(MB_RATE_LIMIT_MS);
    }
  }

  return tagsByArtist;
}

// ===== Cover art =====

/**
 * Build a Cover Art Archive URL without a live existence check.
 * The frontend handles a missing cover (404) via onError with a placeholder fallback.
 */
export function buildCoverArtUrl(mbid: string): string {
  return `https://coverartarchive.org/release-group/${mbid}/front-250`;
}
