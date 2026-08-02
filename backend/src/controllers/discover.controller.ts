import { Request, Response } from 'express';
import UpcomingRelease from '../models/UpcomingRelease';
import { getUserStyles } from '../services/collection.service';
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
