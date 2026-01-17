/**
 * Discogs Controller
 * Thin HTTP handlers that delegate to discogs.service
 */

import { Request, Response } from 'express';
import * as discogsService from '../services/discogs.service';
import { handleDiscogsError } from '../utils/discogs.utils';

/**
 * Search for albums (masters + orphan releases)
 * GET /api/discogs/search?q=query
 */
export async function searchAlbums(req: Request, res: Response) {
    const { q } = req.query;

    if (!q) {
        res.status(400).json({ message: "Missing search parameter 'q'." });
        return;
    }

    try {
        const results = await discogsService.searchAlbums(String(q));
        res.status(200).json(results);
    } catch (error) {
        handleDiscogsError(error, res, 'searching albums on Discogs');
    }
}

/**
 * Search for artists
 * GET /api/discogs/search/artists?q=query
 */
export async function searchArtists(req: Request, res: Response) {
    const { q } = req.query;

    if (!q) {
        res.status(400).json({ message: "Missing search parameter 'q'." });
        return;
    }

    try {
        const results = await discogsService.searchArtists(String(q));
        res.status(200).json(results);
    } catch (error) {
        handleDiscogsError(error, res, 'searching artists on Discogs');
    }
}

/**
 * Search by barcode (UPC/EAN)
 * GET /api/discogs/search/barcode?barcode=123456789
 */
export async function searchByBarcode(req: Request, res: Response) {
    const { barcode } = req.query;

    if (!barcode || typeof barcode !== 'string') {
        res.status(400).json({ message: "The 'barcode' query parameter is required." });
        return;
    }

    try {
        const results = await discogsService.searchByBarcode(barcode);
        res.status(200).json(results);
    } catch (error) {
        handleDiscogsError(error, res, 'searching Discogs by barcode');
    }
}

/**
 * Get artist releases/discography
 * GET /api/discogs/artist/:artistId/releases
 */
export async function getArtistReleases(req: Request, res: Response) {
    const { artistId } = req.params;
    const { sort = 'year', order = 'desc' } = req.query;

    try {
        const result = await discogsService.getArtistReleases(
            artistId,
            String(sort),
            String(order)
        );
        res.status(200).json(result);
    } catch (error) {
        handleDiscogsError(error, res, `fetching albums for artist ${artistId}`);
    }
}

/**
 * Get release details
 * GET /api/discogs/release/:releaseId
 */
export async function getReleaseDetails(req: Request, res: Response) {
    const { releaseId } = req.params;

    try {
        const result = await discogsService.getReleaseDetails(releaseId);
        res.status(200).json(result);
    } catch (error) {
        handleDiscogsError(error, res, 'fetching release details from Discogs');
    }
}

/**
 * Get master versions with format filtering
 * GET /api/discogs/master/:masterId/versions
 */
export async function getMasterVersions(req: Request, res: Response) {
    const { masterId } = req.params;

    try {
        const result = await discogsService.getMasterVersions(masterId);
        res.status(200).json(result);
    } catch (error) {
        handleDiscogsError(error, res, `fetching versions for master ${masterId}`);
    }
}

/**
 * Lookup by reference (Discogs ID or Catalog Number)
 * GET /api/discogs/lookup?ref=<value>&type=discogsId|catno
 */
export async function lookupByReference(req: Request, res: Response) {
    const { ref, type } = req.query;

    if (!ref || typeof ref !== 'string') {
        res.status(400).json({ message: "The 'ref' query parameter is required." });
        return;
    }

    const lookupType = type === 'catno' ? 'catno' : 'discogsId';

    try {
        const results = await discogsService.lookupByReference(ref, lookupType);
        res.status(200).json(results);
    } catch (error) {
        handleDiscogsError(error, res, 'looking up Discogs reference');
    }
}
