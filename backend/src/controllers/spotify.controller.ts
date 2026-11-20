/**
 * Spotify Controller
 * Thin HTTP handler for importing album metadata from a pasted Spotify link.
 */

import { Request, Response } from 'express';
import { logger } from '../config/logger.config';
import {
  InvalidSpotifyUrlError,
  MissingSpotifyCredentialsError,
  SpotifyAlbumNotFoundError,
  importSpotifyAlbum
} from '../services/spotify.service';

/**
 * GET /api/spotify/album?url=https://open.spotify.com/.../album/<id>
 * Also accepts ?id=<spotify album id> for callers that already parsed the link.
 */
export async function getSpotifyAlbum(req: Request, res: Response): Promise<void> {
  const rawUrl = req.query.url;
  const rawId = req.query.id;
  const input = typeof rawUrl === 'string'
    ? rawUrl
    : typeof rawId === 'string'
      ? `spotify:album:${rawId}`
      : '';

  if (!input.trim()) {
    res.status(400).json({ message: "The 'url' query parameter is required." });
    return;
  }

  try {
    const album = await importSpotifyAlbum(input);
    res.status(200).json(album);
  } catch (error) {
    if (error instanceof InvalidSpotifyUrlError) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof MissingSpotifyCredentialsError) {
      res.status(503).json({ message: error.message });
      return;
    }
    if (error instanceof SpotifyAlbumNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    logger.error({ err: error }, 'Error importing an album from Spotify');
    res.status(502).json({ message: 'Could not import the album from Spotify. Please try again.' });
  }
}
