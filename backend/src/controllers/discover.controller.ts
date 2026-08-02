import { Request, Response } from 'express';
import UpcomingRelease from '../models/UpcomingRelease';
import { getUserStyles } from '../services/collection.service';
import { getShopsForPosition, geocodePlace } from '../services/overpass.service';
import { lookupIp } from '../services/geoip.service';
import { haversineKm } from '../utils/geo.utils';
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

export const MIN_SHOP_RADIUS_KM = 1;
export const MAX_SHOP_RADIUS_KM = 1000;

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

export async function getRecordShops(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const lat = parseFloat(String(req.query.lat));
    const lon = parseFloat(String(req.query.lon));
    const radius = parseInt(String(req.query.radius ?? 25), 10);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lon) || lon < -180 || lon > 180) {
      res.status(400).json({ message: 'lat and lon must be valid coordinates' });
      return;
    }
    if (isNaN(radius) || radius < MIN_SHOP_RADIUS_KM || radius > MAX_SHOP_RADIUS_KM) {
      res.status(400).json({ message: `radius must be between ${MIN_SHOP_RADIUS_KM} and ${MAX_SHOP_RADIUS_KM} km` });
      return;
    }

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
