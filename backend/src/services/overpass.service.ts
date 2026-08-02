/**
 * OpenStreetMap lookups for the "record shops near you" discover feature.
 *
 * Overpass and Nominatim are free and need no API key, but both are volunteer
 * infrastructure with strict usage policies: an identifiable User-Agent, at
 * most ~1 req/sec, and heavy caching on our side. See:
 * https://operations.osmfoundation.org/policies/
 *
 * Data is ODbL — every consumer must show the "© OpenStreetMap contributors"
 * attribution.
 */

import axios from 'axios';
import RecordShopCache, { ICachedShop } from '../models/RecordShopCache';
import { roundToTile } from '../utils/geo.utils';
import { logger } from '../config/logger.config';

// ===== Constants =====

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
export const OSM_HEADERS = {
  'User-Agent': 'Musivault/1.0 (https://github.com/musivault)',
  'Accept': 'application/json',
};

/**
 * Tiles are fetched at one of two radii, then the user's own radius filters the
 * result — so moving the slider within a band never refetches. Two bands rather
 * than one because a 1000 km Overpass query is dramatically more expensive, and
 * making everyone pay it just so the rare wide search is instant is a bad trade.
 * Each includes 10 km of slack for the ~7.9 km a user can sit from their tile
 * centre, which would otherwise clip results at the top of the band.
 */
const RADIUS_BANDS_KM = [110, 1010] as const;

const KM_PER_DEGREE_LAT = 111.32;

const OVERPASS_TIMEOUT_MS = 40_000;
/** The wide band scans a continent-sized area and legitimately takes minutes. */
const WIDE_OVERPASS_TIMEOUT_MS = 200_000;
const NOMINATIM_TIMEOUT_MS = 10_000;

/** Shops move rarely and Overpass is expensive to hit, so cache tiles for a month. */
const SHOP_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const OSM_RATE_LIMIT_MS = 1100;
const OSM_MAX_RETRIES = 2;
const OSM_RETRY_BACKOFF_MS = 3000;

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** True when a cached tile is past its TTL and should be refreshed. */
export function isShopCacheStale(fetchedAt?: Date | string | null): boolean {
  if (!fetchedAt) return true;
  return Date.now() - new Date(fetchedAt).getTime() > SHOP_CACHE_TTL_MS;
}

/**
 * Overpass answers 429 ("too many requests") and 504 under load, unrelated to
 * our own pacing. Retry those with backoff instead of failing the request.
 */
async function requestWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= OSM_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const retryable = status === 429 || status === 503 || status === 504 || !status;
      if (!retryable || attempt === OSM_MAX_RETRIES) {
        throw error;
      }
      await delay(OSM_RETRY_BACKOFF_MS * (attempt + 1));
    }
  }
  throw lastError;
}

// ===== Types =====

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
  /** Present when the query aborted (timeout, out of memory) despite a 200. */
  remark?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  label: string;
}

// ===== Overpass =====

/** Smallest band that fully covers the requested radius. */
function bandFor(radiusKm: number): number {
  return RADIUS_BANDS_KM.find((band) => radiusKm + 10 <= band) ?? RADIUS_BANDS_KM[RADIUS_BANDS_KM.length - 1];
}

/**
 * A bounding box around the point, sized to contain the band's circle.
 *
 * Overpass evaluates a bbox far more cheaply than `around:` at large radii —
 * `around:1010000` reliably blows its own time budget. The box is a superset of
 * the circle, and callers filter by true distance anyway, so nothing is lost.
 */
function boundingBox(lat: number, lon: number, bandKm: number): string {
  const dLat = bandKm / KM_PER_DEGREE_LAT;
  // Meridians converge towards the poles, so a degree of longitude covers less
  // ground the further north you are. Floored so the division stays sane there.
  const dLon = bandKm / (KM_PER_DEGREE_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const south = Math.max(lat - dLat, -90);
  const north = Math.min(lat + dLat, 90);
  const west = Math.max(lon - dLon, -180);
  const east = Math.min(lon + dLon, 180);

  return `${south},${west},${north},${east}`;
}

/**
 * `shop=music` is OSM's tag for shops selling recorded music; `shop=records`
 * is a less common synonym. Instrument shops (`shop=musical_instrument`) are
 * deliberately excluded — they are not record shops.
 */
function buildOverpassQuery(lat: number, lon: number, bandKm: number): string {
  const bbox = boundingBox(lat, lon, bandKm);
  // The server-side timeout has to scale with the band: the wide one genuinely
  // needs longer than Overpass's 25s default and would be killed mid-query.
  const timeoutSec = bandKm > 200 ? 180 : 25;
  return `[out:json][timeout:${timeoutSec}];
(
  nwr["shop"="music"](${bbox});
  nwr["shop"="records"](${bbox});
);
out center tags;`;
}

function normalizeElement(element: OverpassElement): ICachedShop | null {
  const tags = element.tags || {};
  const name = tags.name?.trim();
  if (!name) return null;

  // Nodes carry their own coordinates; ways and relations get a computed centre.
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const houseNumber = tags['addr:housenumber'];
  const street = tags['addr:street'];

  return {
    osmType: element.type,
    osmId: element.id,
    name,
    lat,
    lon,
    street: street ? [houseNumber, street].filter(Boolean).join(' ') : undefined,
    city: tags['addr:city'] || undefined,
    postcode: tags['addr:postcode'] || undefined,
    country: tags['addr:country'] || undefined,
    website: tags.website || tags['contact:website'] || undefined,
    phone: tags.phone || tags['contact:phone'] || undefined,
    openingHours: tags.opening_hours || undefined,
  };
}

async function fetchTileFromOverpass(lat: number, lon: number, bandKm: number): Promise<ICachedShop[]> {
  await delay(OSM_RATE_LIMIT_MS);

  const { data } = await requestWithRetry(async () => {
    const response = await axios.post<OverpassResponse>(
      OVERPASS_URL,
      new URLSearchParams({ data: buildOverpassQuery(lat, lon, bandKm) }).toString(),
      {
        headers: { ...OSM_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
        // Must outlast the server-side timeout baked into the query itself.
        timeout: bandKm > 200 ? WIDE_OVERPASS_TIMEOUT_MS : OVERPASS_TIMEOUT_MS,
      }
    );

    // When the dispatcher is down, Overpass answers 200 with an HTML error
    // page. Left unchecked that reads as "no shops here" and would be cached
    // as an empty tile for a month — so treat it as a retryable failure.
    if (!Array.isArray(response.data?.elements)) {
      throw new Error('Overpass returned a non-JSON response (service likely unavailable)');
    }
    // A query that exceeds its time or memory budget also comes back 200, with
    // a valid but empty element list and the reason in `remark`. That reads as
    // a legitimate "no shops here" and would poison the cache for a month.
    if (response.data.remark) {
      throw new Error(`Overpass query did not complete: ${response.data.remark}`);
    }
    return response;
  });

  const shops: ICachedShop[] = [];
  const seen = new Set<string>();

  for (const element of data.elements || []) {
    const shop = normalizeElement(element);
    if (!shop) continue;
    // A shop mapped as both a node and a building way would otherwise appear twice.
    const dedupeKey = `${shop.name.toLowerCase()}|${shop.lat.toFixed(4)},${shop.lon.toFixed(4)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    shops.push(shop);
  }

  return shops;
}

/**
 * Concurrent requests for the same tile share one Overpass call — without this,
 * a page load from several users in the same city would fan out into duplicate
 * 40-second queries.
 */
const inFlight = new Map<string, Promise<ICachedShop[]>>();

/**
 * Every shop within the band covering the given radius, from cache when fresh.
 *
 * Distance filtering is the caller's job: a whole band is fetched at once so
 * that nudging the radius slider inside it never triggers a refetch.
 */
export async function getShopsForPosition(lat: number, lon: number, radiusKm: number): Promise<ICachedShop[]> {
  const tile = roundToTile(lat, lon);
  const band = bandFor(radiusKm);
  // The band is part of the cache key, so the two bands coexist per tile
  // without needing a second index on the collection.
  const cacheKey = `${tile.key}@${band}`;

  // A cached wider band already contains everything a narrower one would, so
  // prefer it and skip the fetch entirely.
  const usable = await RecordShopCache.find({
    tileKey: { $in: RADIUS_BANDS_KM.filter((b) => b >= band).map((b) => `${tile.key}@${b}`) },
  }).lean();

  const cached = usable.find((entry) => entry.tileKey === cacheKey);
  const fresh = usable.find((entry) => !isShopCacheStale(entry.fetchedAt));
  if (fresh) return fresh.shops;

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    try {
      const shops = await fetchTileFromOverpass(tile.lat, tile.lon, band);
      await RecordShopCache.findOneAndUpdate(
        { tileKey: cacheKey },
        { tileKey: cacheKey, shops, fetchedAt: new Date() },
        { upsert: true }
      );
      return shops;
    } catch (error) {
      // A stale tile beats an error page — the data is a month old at worst.
      const stale = cached ?? usable[0];
      if (stale) {
        logger.warn({ err: error, tileKey: cacheKey }, 'Overpass refresh failed, serving stale record shop cache');
        return stale.shops;
      }
      throw error;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, request);
  return request;
}

// ===== Nominatim =====

/**
 * Free-text place lookup, used when the browser geolocation is refused.
 * Proxied through the backend because Nominatim requires an identifying
 * User-Agent, which browsers refuse to set.
 */
export async function geocodePlace(query: string, limit = 5): Promise<GeocodeResult[]> {
  await delay(OSM_RATE_LIMIT_MS);

  const { data } = await requestWithRetry(async () => {
    const response = await axios.get<NominatimResult[]>(NOMINATIM_URL, {
      params: { q: query, format: 'json', limit, addressdetails: 0 },
      headers: OSM_HEADERS,
      timeout: NOMINATIM_TIMEOUT_MS,
    });

    // Same failure mode as Overpass: an error page served with a 200.
    if (!Array.isArray(response.data)) {
      throw new Error('Nominatim returned a non-JSON response (service likely unavailable)');
    }
    return response;
  });

  return data
    .map((result) => ({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      label: result.display_name,
    }))
    .filter((result) => !isNaN(result.lat) && !isNaN(result.lon));
}
