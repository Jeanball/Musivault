/**
 * Ticketmaster Discovery API lookups for the "shows near you" discover feature.
 *
 * Unlike OpenStreetMap this is a commercial, keyed API: a Consumer Key is
 * required (the Consumer Secret issued alongside it belongs to the Commerce
 * APIs and is not used here). The free tier allows 5000 calls a day at 5 req/s,
 * which the tile cache below keeps us comfortably inside.
 * https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */

import axios from 'axios';
import ConcertCache, { ICachedEvent } from '../models/ConcertCache';
import { roundToTile, bandFor, geohashEncode, RADIUS_BANDS_KM } from '../utils/geo.utils';
import { logger } from '../config/logger.config';

// ===== Constants =====

const TM_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

/** Listings churn constantly — new onsales, cancellations, added dates. */
const CONCERT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Upper bound accepted for the UI's date filter. Not a fetch limit: the sweep
 * below is open-ended, so a shorter window is only ever a local filter.
 */
export const MAX_CONCERT_DAYS = 730;

/** 5 req/s is the documented ceiling; 250 ms leaves margin for clock jitter. */
const TM_RATE_LIMIT_MS = 250;
const TM_TIMEOUT_MS = 20_000;
const TM_MAX_RETRIES = 2;
const TM_RETRY_BACKOFF_MS = 2000;

const PAGE_SIZE = 200;
/** Discovery refuses to page past the 1000th item (`size * page < 1000`). */
const MAX_PAGES = Math.floor(1000 / PAGE_SIZE);

/** Thrown when no Consumer Key is configured, so callers can say so plainly. */
export class MissingTicketmasterKeyError extends Error {
  constructor() {
    super('TICKETMASTER_API_KEY is not configured');
    this.name = 'MissingTicketmasterKeyError';
  }
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** True when a cached tile is past its TTL and should be refreshed. */
function isConcertCacheStale(fetchedAt?: Date | string | null): boolean {
  if (!fetchedAt) return true;
  return Date.now() - new Date(fetchedAt).getTime() > CONCERT_CACHE_TTL_MS;
}

/** Ticketmaster answers 429 when the burst limit is hit, and 5xx under load. */
async function requestWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TM_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || !status;
      if (!retryable || attempt === TM_MAX_RETRIES) {
        throw error;
      }
      await delay(TM_RETRY_BACKOFF_MS * (attempt + 1));
    }
  }
  throw lastError;
}

// ===== Types =====

interface TmImage {
  url: string;
  ratio?: string;
  width?: number;
  height?: number;
}

interface TmEvent {
  id: string;
  name?: string;
  url?: string;
  images?: TmImage[];
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTBA?: boolean; timeTBA?: boolean };
    status?: { code?: string };
  };
  classifications?: Array<{
    genre?: { name?: string };
    subGenre?: { name?: string };
  }>;
  priceRanges?: Array<{ currency?: string; min?: number; max?: number }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      location?: { latitude?: string; longitude?: string };
    }>;
    attractions?: Array<{ name?: string }>;
  };
}

interface TmResponse {
  _embedded?: { events?: TmEvent[] };
  page?: { size: number; totalElements: number; totalPages: number; number: number };
}

// ===== Fetching =====

/** Discovery wants `YYYY-MM-DDTHH:mm:ssZ` and rejects the milliseconds Date emits. */
const toTmDate = (date: Date): string => `${date.toISOString().slice(0, 19)}Z`;

/**
 * How many times the date cursor may advance. Each round harvests up to 1000
 * events, so this is a runaway guard rather than a real ceiling.
 */
const MAX_ROUNDS = 12;

function normalizeEvent(event: TmEvent): ICachedEvent | null {
  const name = event.name?.trim();
  const venue = event._embedded?.venues?.[0];
  const lat = Number(venue?.location?.latitude);
  const lon = Number(venue?.location?.longitude);
  const startLocalDate = event.dates?.start?.localDate;

  // No coordinates means no distance, and distance is the whole premise of the
  // feature; no date means nothing to show on a card. Both are rare enough that
  // dropping the event beats rendering a broken one.
  if (!name || !event.url || !startLocalDate) return null;
  if (isNaN(lat) || isNaN(lon)) return null;

  const classification = event.classifications?.[0];
  const price = event.priceRanges?.[0];

  // 16_9 is the only ratio every event reliably carries; take the widest one so
  // the card isn't upscaling a thumbnail.
  const image = (event.images || [])
    .filter((img) => img.ratio === '16_9' && img.url)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
    ?? event.images?.[0];

  return {
    tmId: event.id,
    name,
    url: event.url,
    imageUrl: image?.url,
    startLocalDate,
    startLocalTime: event.dates?.start?.localTime,
    dateTBA: event.dates?.start?.dateTBA ?? false,
    timeTBA: event.dates?.start?.timeTBA ?? false,
    status: event.dates?.status?.code,
    genre: classification?.genre?.name,
    subGenre: classification?.subGenre?.name,
    priceMin: price?.min,
    priceMax: price?.max,
    priceCurrency: price?.currency,
    venueName: venue?.name || '',
    venueCity: venue?.city?.name,
    lat,
    lon,
    attractions: (event._embedded?.attractions || [])
      .map((attraction) => attraction.name?.trim())
      .filter((attractionName): attractionName is string => Boolean(attractionName)),
  };
}

interface SweepOptions {
  apikey: string;
  geoPoint: string;
  bandKm: number;
  /** No end date is ever sent: the sweep walks forward by cursor instead. */
  start: Date;
  page?: number;
}

async function fetchPage({ apikey, geoPoint, bandKm, start, page = 0 }: SweepOptions): Promise<TmResponse> {
  await delay(TM_RATE_LIMIT_MS);

  const { data } = await requestWithRetry(() =>
    axios.get<TmResponse>(TM_URL, {
      params: {
        apikey,
        geoPoint,
        radius: Math.round(bandKm),
        unit: 'km',
        classificationName: 'Music',
        startDateTime: toTmDate(start),
        size: PAGE_SIZE,
        page,
        sort: 'date,asc',
      },
      timeout: TM_TIMEOUT_MS,
    })
  );

  return data;
}

/**
 * Every music event around a tile, however far ahead it is listed.
 *
 * There is no end date and no fixed horizon: Discovery routinely lists a year
 * or two out, and cutting the sweep short just hides real concerts. The only
 * real constraint is that it refuses to page past its 1000th result — and
 * because results come back oldest-first, a naive sweep loses the far future
 * rather than the near.
 *
 * So the sweep walks forward instead: each round takes up to 1000 events, then
 * restarts from the date of the last one seen. Quiet regions finish in a single
 * request; a dense metro takes a handful of rounds. Slicing the calendar into
 * fixed months instead was measured at nearly five times the requests, since
 * most of the far-out months are almost empty yet still cost one call each.
 */
async function fetchTileFromTicketmaster(lat: number, lon: number, bandKm: number): Promise<ICachedEvent[]> {
  const apikey = process.env.TICKETMASTER_API_KEY;
  if (!apikey) throw new MissingTicketmasterKeyError();

  const geoPoint = geohashEncode(lat, lon);
  const base: Omit<SweepOptions, 'start'> = { apikey, geoPoint, bandKm };
  const events = new Map<string, ICachedEvent>();

  let cursor = new Date();

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let totalPages = 0;
    let lastDate: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await fetchPage({ ...base, start: cursor, page });

      for (const event of data._embedded?.events || []) {
        // Rounds overlap by a day at the seam, so the same event can arrive
        // twice; keying by id settles it.
        const normalized = normalizeEvent(event);
        if (normalized) events.set(normalized.tmId, normalized);
      }

      const pageEvents = data._embedded?.events ?? [];
      lastDate = pageEvents[pageEvents.length - 1]?.dates?.start?.localDate ?? lastDate;
      totalPages = data.page?.totalPages ?? 0;
      if (page + 1 >= totalPages) break;
    }

    // Everything fit under the ceiling, so there is nothing past this round.
    if (totalPages <= MAX_PAGES) break;

    const next = lastDate ? new Date(`${lastDate}T00:00:00Z`) : null;
    if (!next || next <= cursor) {
      // Over 1000 events on a single day — vanishingly unlikely, but advancing
      // the cursor is the only thing keeping this loop finite.
      logger.warn(
        { geoPoint, bandKm, cursor, lastDate },
        'Ticketmaster date cursor stopped advancing, some concerts were not fetched'
      );
      break;
    }
    cursor = next;
  }

  return Array.from(events.values());
}

/**
 * Concurrent requests for the same tile share one sweep — without this, a page
 * load from several users in the same city would burn the daily quota several
 * times over on identical queries.
 */
const inFlight = new Map<string, Promise<ICachedEvent[]>>();

/**
 * Every concert within the band covering the given radius, from cache when fresh.
 *
 * Distance and date filtering are the caller's job: a whole band and the entire
 * future are fetched at once so that narrowing either never triggers a refetch.
 */
export async function getConcertsForPosition(lat: number, lon: number, radiusKm: number): Promise<ICachedEvent[]> {
  const tile = roundToTile(lat, lon);
  const band = bandFor(radiusKm);
  const cacheKey = `${tile.key}@${band}`;

  // A cached wider band already contains everything a narrower one would, so
  // prefer it and skip the fetch entirely.
  const usable = await ConcertCache.find({
    tileKey: { $in: RADIUS_BANDS_KM.filter((b) => b >= band).map((b) => `${tile.key}@${b}`) },
  }).lean();

  const cached = usable.find((entry) => entry.tileKey === cacheKey);
  const fresh = usable.find((entry) => !isConcertCacheStale(entry.fetchedAt));
  if (fresh) return fresh.events;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    try {
      const events = await fetchTileFromTicketmaster(tile.lat, tile.lon, band);
      await ConcertCache.findOneAndUpdate(
        { tileKey: cacheKey },
        { tileKey: cacheKey, events, fetchedAt: new Date() },
        { upsert: true }
      );
      return events;
    } catch (error) {
      // A missing key is a configuration problem, not a transient one — never
      // paper over it with stale data.
      if (error instanceof MissingTicketmasterKeyError) throw error;

      // Stale listings beat an error page; past events are filtered out anyway.
      const stale = cached ?? usable[0];
      if (stale) {
        logger.warn({ err: error, tileKey: cacheKey }, 'Ticketmaster refresh failed, serving stale concert cache');
        return stale.events;
      }
      throw error;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, request);
  return request;
}
