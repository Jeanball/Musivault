/**
 * Shows Controller
 * HTTP handler for nearby shows endpoint.
 */

import { Request, Response } from 'express';
import { getNearbyShows } from '../services/shows.service';

/**
 * Get nearby shows for the authenticated user.
 * GET /api/shows/nearby?latitude=XX&longitude=YY&radius=ZZ
 */
export async function nearbyShows(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const latitude = parseFloat(req.query.latitude as string);
    const longitude = parseFloat(req.query.longitude as string);
    const radius = parseFloat(req.query.radius as string) || 200;

    if (isNaN(latitude) || isNaN(longitude)) {
      res.status(400).json({
        message: 'Missing or invalid latitude/longitude parameters.',
      });
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      res.status(400).json({
        message: 'Latitude must be between -90 and 90, longitude between -180 and 180.',
      });
      return;
    }

    const shows = await getNearbyShows(
      req.user.id,
      latitude,
      longitude,
      radius
    );

    res.status(200).json(shows);
  } catch (error) {
    console.error('[Shows] Error fetching nearby shows:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
