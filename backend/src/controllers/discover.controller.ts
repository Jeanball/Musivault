import { Request, Response } from 'express';
import UpcomingRelease from '../models/UpcomingRelease';
import { getUserStyles, getUserArtists } from '../services/collection.service';
import { getShopsForPosition, geocodePlace } from '../services/overpass.service';
import {
  getConcertsForPosition,
  getConcertDetails as fetchConcertDetails,
  MissingTicketmasterKeyError,
  ConcertNotFoundError,
  MAX_CONCERT_DAYS,
} from '../services/ticketmaster.service';
import { lookupIp } from '../services/geoip.service';
import { haversineKm, MIN_RADIUS_KM, MAX_RADIUS_KM } from '../utils/geo.utils';
import { discogsStylesToTmGenres } from '../utils/genreMap.utils';
import { normalizeArtistName, isPlaceholderArtist } from '../utils/artist.utils';
import { logger } from '../config/logger.config';

export async function getUpcomingReleases(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const excluded = new Set(req.user.preferences?.discoverExcludedStyles || []);
    const userStyles = (await getUserStyles(req.user._id)).filter((s) => !excluded.has(s));
    if (userStyles.length === 0) {
      res.status(200).json([]);
      return;
    }

    const entries = await UpcomingRelease.find({ style: { $in: userStyles } })
      .sort({ firstReleaseDate: 1 })
      .lean();

    // Multiple styles can match the same release-group (one doc per mbid+style pair) — dedupe by mbid.
    const releasesByMbid = new Map<string, {
      mbid: string;
      title: string;
      artist: string;
      firstReleaseDate: string;
      datePrecision: string;
      primaryType: string;
      secondaryTypes: string[];
      coverArtUrl?: string;
      matchedStyles: string[];
    }>();

    for (const entry of entries) {
      const existing = releasesByMbid.get(entry.mbid);
      if (existing) {
        existing.matchedStyles.push(entry.style);
      } else {
        releasesByMbid.set(entry.mbid, {
          mbid: entry.mbid,
          title: entry.title,
          artist: entry.artist,
          firstReleaseDate: entry.firstReleaseDate,
          datePrecision: entry.datePrecision,
          primaryType: entry.primaryType,
          secondaryTypes: entry.secondaryTypes || [],
          coverArtUrl: entry.coverArtUrl,
          matchedStyles: [entry.style],
        });
      }
    }

    res.status(200).json(Array.from(releasesByMbid.values()));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching upcoming releases');
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Approximate position derived from the caller's IP, so the record shops
 * section can render something before asking for the browser permission.
 * Always 200: an unknown location is an expected outcome, not an error.
 */
export async function getApproximateLocation(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const location = await lookupIp(req.ip);
    if (!location) {
      res.status(200).json({ source: 'unavailable' });
      return;
    }

    res.status(200).json({ ...location, source: 'ip' });
  } catch (error) {
    logger.error({ err: error }, 'Error resolving approximate location');
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * The `lat`/`lon`/`radius` triplet every "near you" endpoint takes, validated
 * once. Returns the message to send with a 400 rather than writing the response
 * itself, so the caller keeps its own error shape.
 */
function parseSearchArea(req: Request): { lat: number; lon: number; radius: number } | { error: string } {
  const lat = parseFloat(String(req.query.lat));
  const lon = parseFloat(String(req.query.lon));
  const radius = parseInt(String(req.query.radius ?? 25), 10);

  if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lon) || lon < -180 || lon > 180) {
    return { error: 'lat and lon must be valid coordinates' };
  }
  if (isNaN(radius) || radius < MIN_RADIUS_KM || radius > MAX_RADIUS_KM) {
    return { error: `radius must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM} km` };
  }

  return { lat, lon, radius };
}

export async function getRecordShops(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const area = parseSearchArea(req);
    if ('error' in area) {
      res.status(400).json({ message: area.error });
      return;
    }
    const { lat, lon, radius } = area;

    // A whole band is cached at once, so narrowing the radius is a local filter.
    const shops = await getShopsForPosition(lat, lon, radius);
    const withinRadius = shops
      .map((shop) => ({ ...shop, distanceKm: haversineKm(lat, lon, shop.lat, shop.lon) }))
      .filter((shop) => shop.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.status(200).json(withinRadius);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching record shops');
    res.status(502).json({ message: 'Could not reach the OpenStreetMap service' });
  }
}

/** Ranks a concert's relevance to the user; `other` is dropped unless asked for. */
const MATCH_RANK: Record<string, number> = { artist: 0, genre: 1, other: 2 };

/**
 * Music events around the user, ranked by how well they fit their collection:
 * an act they already own records from first, then anything in a genre their
 * styles map to.
 */
export async function getConcerts(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const area = parseSearchArea(req);
    if ('error' in area) {
      res.status(400).json({ message: area.error });
      return;
    }
    const { lat, lon, radius } = area;

    // Omitting `days` means "everything Ticketmaster lists", which is often a
    // year or more out — the sweep has no horizon of its own.
    const hasWindow = req.query.days !== undefined && String(req.query.days) !== '';
    const days = hasWindow ? parseInt(String(req.query.days), 10) : null;
    if (days !== null && (isNaN(days) || days < 1 || days > MAX_CONCERT_DAYS)) {
      res.status(400).json({ message: `days must be between 1 and ${MAX_CONCERT_DAYS}` });
      return;
    }
    const includeUnmatched = String(req.query.scope) === 'all';

    const excluded = new Set(req.user.preferences?.discoverExcludedStyles || []);
    const [styles, artists] = await Promise.all([
      getUserStyles(req.user._id),
      getUserArtists(req.user._id),
    ]);
    const stylesByGenre = discogsStylesToTmGenres(styles.filter((s) => !excluded.has(s)));
    const ownedArtists = new Set(
      artists.filter((artist) => !isPlaceholderArtist(artist)).map(normalizeArtistName)
    );

    // The whole future is cached at once, so a shorter window is a local filter.
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = days === null
      ? null
      : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const events = await getConcertsForPosition(lat, lon, radius);
    const matched = events
      // Cancelled shows stay in Ticketmaster's listing long after the fact —
      // roughly 2% of a sweep — and must never be offered as something to attend.
      // "rescheduled" is kept: it is still happening, on the date shown.
      .filter((event) => event.status !== 'cancelled')
      .filter((event) => event.startLocalDate >= today && (cutoff === null || event.startLocalDate <= cutoff))
      .map((event) => {
        const matchedArtists = event.attractions.filter((attraction) =>
          ownedArtists.has(normalizeArtistName(attraction))
        );
        const matchedStyles = event.genre ? stylesByGenre.get(event.genre) ?? [] : [];
        return {
          ...event,
          distanceKm: haversineKm(lat, lon, event.lat, event.lon),
          matchedArtists,
          matchedStyles,
          matchType: matchedArtists.length ? 'artist' : matchedStyles.length ? 'genre' : 'other',
        };
      })
      .filter((event) => event.distanceKm <= radius)
      .filter((event) => includeUnmatched || event.matchType !== 'other')
      .sort((a, b) =>
        MATCH_RANK[a.matchType] - MATCH_RANK[b.matchType] ||
        a.startLocalDate.localeCompare(b.startLocalDate)
      );

    res.status(200).json(matched);
  } catch (error) {
    if (error instanceof MissingTicketmasterKeyError) {
      logger.warn('Concert search requested but TICKETMASTER_API_KEY is not configured');
      res.status(503).json({ message: 'Concert search is not configured' });
      return;
    }
    logger.error({ err: error }, 'Error fetching concerts');
    res.status(502).json({ message: 'Could not reach the Ticketmaster service' });
  }
}

/**
 * One event in full, for the detail modal — fetched lazily on open rather than
 * carried in the list, which already runs to thousands of events per tile.
 */
export async function getConcert(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const tmId = String(req.params.tmId ?? '').trim();
    if (!tmId) {
      res.status(400).json({ message: 'tmId is required' });
      return;
    }

    const [details, artists] = await Promise.all([
      fetchConcertDetails(tmId),
      getUserArtists(req.user._id),
    ]);

    // Same rule as the list, applied act by act: the modal is where a support
    // slot the user collects is worth pointing out.
    const ownedArtists = new Set(
      artists.filter((artist) => !isPlaceholderArtist(artist)).map(normalizeArtistName)
    );

    res.status(200).json({
      ...details,
      lineup: details.lineup.map((act) => ({
        ...act,
        owned: ownedArtists.has(normalizeArtistName(act.name)),
      })),
    });
  } catch (error) {
    if (error instanceof MissingTicketmasterKeyError) {
      logger.warn('Concert details requested but TICKETMASTER_API_KEY is not configured');
      res.status(503).json({ message: 'Concert search is not configured' });
      return;
    }
    if (error instanceof ConcertNotFoundError) {
      res.status(404).json({ message: 'This event is no longer listed' });
      return;
    }
    logger.error({ err: error }, 'Error fetching concert details');
    res.status(502).json({ message: 'Could not reach the Ticketmaster service' });
  }
}

/** Free-text place search backing the manual location fallback. */
export async function geocode(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const query = String(req.query.q ?? '').trim();
    if (query.length < 2) {
      res.status(400).json({ message: 'q must be at least 2 characters' });
      return;
    }

    res.status(200).json(await geocodePlace(query));
  } catch (error) {
    logger.error({ err: error }, 'Error geocoding place');
    res.status(502).json({ message: 'Could not reach the OpenStreetMap service' });
  }
}
