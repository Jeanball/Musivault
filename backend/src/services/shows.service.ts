/**
 * Shows Service
 *
 * Handles fetching and caching concert data from Bandsintown,
 * computing distances via Haversine, and filtering by radius.
 */

import ArtistEventsCache from '../models/ArtistEventsCache';
import type { ICachedEvent } from '../models/ArtistEventsCache';
import { getUserUniqueArtistsWeighted, getAllUniqueArtists } from './collection.shared';
import type { TaskProgressEvent } from './adminTasks.service';

// ===== Constants =====

const BANDSINTOWN_APP_ID = process.env.BANDSINTOWN_APP_ID || 'musivault';
const BANDSINTOWN_BASE_URL = 'https://rest.bandsintown.com';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_API_REQUESTS_PER_LOAD = 25; // Limit cold-load API calls
const BATCH_CONCURRENCY = 5; // Max parallel requests to Bandsintown
const DEFAULT_RADIUS_KM = 200;
let bandsintownTemporarilyDisabled = false;

// ===== Types =====

export interface NearbyShow {
  bandsintown_id: string;
  artist_name: string;
  title: string;
  datetime: string;
  url: string;
  venue: {
    name: string;
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  lineup: string[];
  distance_km: number;
}

interface BandsintownEvent {
  id: string;
  artist_id?: string;
  url: string;
  on_sale_datetime?: string;
  datetime: string;
  title: string;
  description?: string;
  venue: {
    name: string;
    city: string;
    region: string;
    country: string;
    latitude: string;
    longitude: string;
  };
  lineup: string[];
  offers?: { type: string; url: string; status: string }[];
}

// ===== Haversine Distance =====

/**
 * Calculate the distance in km between two latitude/longitude points.
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ===== Bandsintown API =====

/**
 * Fetch upcoming events for an artist from Bandsintown.
 * Returns an empty array if the artist is not found or has no events.
 */
async function fetchBandsintownEvents(artistName: string): Promise<ICachedEvent[] | null> {
  try {
    if (bandsintownTemporarilyDisabled) {
      return null;
    }

    // Encode special characters as per Bandsintown API requirements
    const encodedName = encodeURIComponent(artistName)
      .replace(/%2F/g, '%252F')
      .replace(/%3F/g, '%253F')
      .replace(/%2A/g, '%252A')
      .replace(/%22/g, '%27C');

    const url = `${BANDSINTOWN_BASE_URL}/artists/${encodedName}/events/?app_id=${BANDSINTOWN_APP_ID}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Artist not found — cache empty result
        return [];
      }
      if (response.status === 429) {
        console.warn(`[Shows] Rate limited by Bandsintown for "${artistName}". Skipping.`);
        throw new Error('RATE_LIMITED');
      }
      if (response.status === 403) {
        bandsintownTemporarilyDisabled = true;
        console.warn('[Shows] Bandsintown rejected the current app_id. Disabling live fetches until restart.');
        return null;
      }
      console.warn(`[Shows] Bandsintown returned ${response.status} for "${artistName}".`);
      return [];
    }

    const data = await response.json() as BandsintownEvent[];

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(event => ({
      bandsintown_id: String(event.id || ''),
      artist_name: artistName,
      title: event.title || '',
      datetime: event.datetime || '',
      url: event.url || '',
      venue: {
        name: event.venue?.name || '',
        city: event.venue?.city || '',
        region: event.venue?.region || '',
        country: event.venue?.country || '',
        latitude: parseFloat(event.venue?.latitude) || null,
        longitude: parseFloat(event.venue?.longitude) || null,
      },
      lineup: event.lineup || [],
    }));
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      throw error;
    }
    console.error(`[Shows] Error fetching events for "${artistName}":`, error);
    return [];
  }
}

// ===== Cache Logic =====

/**
 * Get cached events for an artist, or fetch from Bandsintown if stale/missing.
 * Returns null if rate-limited (so we don't overwrite existing cache).
 */
async function getOrFetchArtistEvents(
  artistName: string,
  options: { forceRefresh?: boolean } = {}
): Promise<ICachedEvent[] | null> {
  const cacheKey = artistName.toLowerCase().trim();

  // Check cache
  const cached = await ArtistEventsCache.findOne({ artistName: cacheKey }).lean();

  if (!options.forceRefresh && cached && (Date.now() - new Date(cached.updatedAt).getTime()) < CACHE_TTL_MS) {
    return cached.events;
  }

  // Fetch fresh data
  try {
    const events = await fetchBandsintownEvents(artistName);

    if (events === null) {
      return cached?.events ?? null;
    }

    // Upsert cache (including empty results to avoid re-fetching)
    await ArtistEventsCache.findOneAndUpdate(
      { artistName: cacheKey },
      { events, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    return events;
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      // Return existing cache if available, otherwise null
      return cached?.events ?? null;
    }
    return cached?.events ?? [];
  }
}

// ===== Batch Processing =====

/**
 * Process artists in batches with limited concurrency.
 */
async function processBatch<T>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(processor));
  }
}

// ===== Public API =====

/**
 * Get nearby shows for a user based on their collection.
 * Returns concerts sorted by date (soonest first), filtered by radius.
 */
export async function getNearbyShows(
  userId: string,
  latitude: number,
  longitude: number,
  radiusKm: number = DEFAULT_RADIUS_KM
): Promise<NearbyShow[]> {
  // 1. Get the user's unique artists, sorted by album count
  const artists = await getUserUniqueArtistsWeighted(userId);

  if (artists.length === 0) {
    return [];
  }

  // 2. Separate artists into cached (fresh) and stale/missing
  const allEvents: ICachedEvent[] = [];
  const artistsToFetch: string[] = [];

  for (const artist of artists) {
    const cacheKey = artist.name.toLowerCase().trim();
    const cached = await ArtistEventsCache.findOne({ artistName: cacheKey }).lean();

    if (cached && (Date.now() - new Date(cached.updatedAt).getTime()) < CACHE_TTL_MS) {
      allEvents.push(...cached.events);
    } else {
      artistsToFetch.push(artist.name);
    }
  }

  // 3. Fetch stale/missing artists (limited to MAX_API_REQUESTS_PER_LOAD)
  const toFetchNow = artistsToFetch.slice(0, MAX_API_REQUESTS_PER_LOAD);

  await processBatch(toFetchNow, BATCH_CONCURRENCY, async (artistName) => {
    const events = await getOrFetchArtistEvents(artistName);
    if (events) {
      allEvents.push(...events);
    }
  });

  // 4. Filter: exclude virtual events (no valid coordinates)
  const physicalEvents = allEvents.filter(event =>
    event.venue.latitude !== null &&
    event.venue.longitude !== null &&
    event.venue.latitude !== 0 &&
    event.venue.longitude !== 0
  );

  // 5. Filter: only future events
  const now = new Date();
  const futureEvents = physicalEvents.filter(event => {
    const eventDate = new Date(event.datetime);
    return eventDate >= now;
  });

  // 6. Calculate distance and filter by radius
  const nearbyShows: NearbyShow[] = [];

  for (const event of futureEvents) {
    const distance = haversineDistance(
      latitude, longitude,
      event.venue.latitude!, event.venue.longitude!
    );

    if (distance <= radiusKm) {
      nearbyShows.push({
        ...event,
        venue: {
          ...event.venue,
          latitude: event.venue.latitude!,
          longitude: event.venue.longitude!,
        },
        distance_km: Math.round(distance),
      });
    }
  }

  // 7. Deduplicate by bandsintown_id
  const seen = new Set<string>();
  const deduped = nearbyShows.filter(show => {
    if (!show.bandsintown_id || seen.has(show.bandsintown_id)) return false;
    seen.add(show.bandsintown_id);
    return true;
  });

  // 8. Sort by date (soonest first)
  deduped.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  return deduped;
}

/**
 * Refresh the shows cache for ALL artists in the database.
 * Used by the admin task manager.
 */
export async function refreshAllShowsCache(
  onProgress?: (event: TaskProgressEvent) => void,
  options: { forceRefresh?: boolean } = {}
): Promise<string> {
  const artists = await getAllUniqueArtists();

  if (artists.length === 0) {
    return 'No artists found in the database.';
  }

  let processed = 0;
  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  onProgress?.({ type: 'start', total: artists.length });

  if (options.forceRefresh) {
    bandsintownTemporarilyDisabled = false;
  }

  await processBatch(artists, BATCH_CONCURRENCY, async (artistName) => {
    processed++;

    try {
      const cacheKey = artistName.toLowerCase().trim();
      const cached = await ArtistEventsCache.findOne({ artistName: cacheKey }).lean();

      // Skip if cache is still fresh
      if (!options.forceRefresh && cached && (Date.now() - new Date(cached.updatedAt).getTime()) < CACHE_TTL_MS) {
        skipped++;
        onProgress?.({ type: 'progress', processed, fetched, skipped, errors, total: artists.length });
        return;
      }

      const events = await getOrFetchArtistEvents(artistName, { forceRefresh: options.forceRefresh });
      if (events === null) {
        errors++;
      } else {
        fetched++;
      }
    } catch {
      errors++;
    }

    onProgress?.({ type: 'progress', processed, fetched, skipped, errors, total: artists.length });
  });

  onProgress?.({ type: 'complete', processed, fetched, skipped, errors, total: artists.length });

  return `Refreshed shows cache: ${fetched} fetched, ${skipped} already fresh, ${errors} errors (${artists.length} total artists).`;
}
