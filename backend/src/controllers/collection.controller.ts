import { Request, Response } from 'express';
import type { Express } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import Album, { IAlbum, ITrack, ILabel } from '../models/Album';
import CollectionItem, { ICollectionItem, IAlbumOverrides } from '../models/CollectionItem';
import { csvImportService } from '../services/import.service';
import { csvExportService } from '../services/export.service';
import { getMarketplaceStats, mapReleaseToAlbumUpdate } from '../services/discogs.service';
import { buildPriceCache, getPriceTTLHours, isPriceStale } from '../utils/price.utils';
import { getUserStyles } from '../services/collection.service';
import { discogsRequest, stripArtistSuffixes } from '../utils/discogs.utils';
import type { DiscogsReleaseResponse, MarketplaceStats } from '../types/discogs.types';
import AdminTaskExecution from '../models/AdminTaskExecution';
import { getValueForItem, getValueHistory, recordValueSnapshot } from '../services/valueSnapshot.service';
import { validateCustomFieldValues } from './customFields.controller';
import { COVERS_DIR } from '../config/uploads.config';
import { logger } from '../config/logger.config';
import { downloadCoverToLocal } from '../utils/cover.utils';
import {
  applyAlbumOverrides,
  applyAlbumOverridesToAll,
  buildAlbumOverrides,
  hasAlbumOverrides,
  mergeAlbumOverrides
} from '../utils/albumOverrides.utils';

// ===== Types =====

type AddToCollectionBody = {
  discogsId: number;
  title: string;
  artist: string;
  year: string;
  thumb: string;
  cover_image: string;
  format: ICollectionItem['format'];
  genres?: string[];
  styles?: string[];
  tracklist?: ITrack[];
  labels?: ILabel[];
  mediaCondition?: string;
  sleeveCondition?: string;
};

export type PopulatedCollectionItem = ICollectionItem & {
  album: IAlbum;
};

export interface PriceSyncResult {
  syncedReleases: number;
  syncedItems: number;
  skippedFresh: number;
  skippedNoData: number;
  totalReleases: number;
  totalItems: number;
  totalValue: number;
  currency: string;
  forceRefresh: boolean;
}

/**
 * Core price sync logic. Iterates over collection items grouped by release,
 * fetches prices from Discogs, and updates the database.
 * Accepts a progress callback and an optional abort signal.
 */
export async function executePriceSync(
  items: PopulatedCollectionItem[],
  options: {
    forceRefresh?: boolean;
    logLabel?: string;
    onProgress?: (event: Record<string, unknown>) => void;
    shouldAbort?: () => boolean;
  } = {}
): Promise<PriceSyncResult> {
  const forceRefresh = options.forceRefresh ?? false;
  const logLabel = options.logLabel ?? 'PriceSync';
  const onProgress = options.onProgress ?? (() => {});
  const shouldAbort = options.shouldAbort ?? (() => false);

  const groupedByRelease = new Map<number, PopulatedCollectionItem[]>();
  const noDiscogsItems: PopulatedCollectionItem[] = [];

  for (const item of items) {
    const discogsId = item.album?.discogsId;
    if (!discogsId) {
      noDiscogsItems.push(item);
      continue;
    }
    if (!groupedByRelease.has(discogsId)) {
      groupedByRelease.set(discogsId, []);
    }
    groupedByRelease.get(discogsId)!.push(item);
  }

  const totalReleases = groupedByRelease.size;
  const totalItems = items.length;
  let syncedReleases = 0;
  let syncedItems = 0;
  let skippedFresh = 0;
  let skippedNoData = 0;
  let releaseIdx = 0;

  logger.info(`[${logLabel}] Starting sync: ${totalItems} items, ${totalReleases} unique releases, ${noDiscogsItems.length} without discogsId, forceRefresh=${forceRefresh}`);

  for (const [discogsId, releaseItems] of groupedByRelease) {
    releaseIdx++;
    const firstItem = releaseItems[0];
    const artist = firstItem.album?.artist || 'Unknown';
    const title = firstItem.album?.title || 'Unknown';

    const shouldSync = forceRefresh || releaseItems.some(item => isPriceStale(item.priceCache?.updatedAt));

    if (!shouldSync) {
      skippedFresh += releaseItems.length;
      continue;
    }

    onProgress({
      type: 'progress',
      current: releaseIdx,
      total: totalReleases,
      artist,
      title,
      itemCount: releaseItems.length,
    });

    const stats = await getMarketplaceStats(discogsId, { forceRefresh });

    if (stats) {
      const priceCache = buildPriceCache(stats);

      await CollectionItem.updateMany(
        { _id: { $in: releaseItems.map(item => item._id) } },
        { $set: { priceCache } }
      );

      for (const item of releaseItems) {
        item.priceCache = priceCache;
      }

      syncedReleases++;
      syncedItems += releaseItems.length;
      logger.debug(`[${logLabel}] ${releaseIdx}/${totalReleases} SUCCESS - ${artist} - ${title} (${releaseItems.length} items) | VG+: ${stats.veryGoodPlus} ${stats.currency}`);
    } else {
      skippedNoData += releaseItems.length;
      logger.debug(`[${logLabel}] ${releaseIdx}/${totalReleases} NO DATA - ${artist} - ${title}`);
    }

    if (shouldAbort()) {
      logger.info(`[${logLabel}] Aborted.`);
      break;
    }
  }

  let totalValue = 0;
  let currency = 'USD';
  for (const item of items) {
    const value = getValueForItem(item);
    if (value > 0) {
      totalValue += value;
      currency = item.priceCache?.currency || 'USD';
    }
  }

  const result: PriceSyncResult = {
    syncedReleases,
    syncedItems,
    skippedFresh,
    skippedNoData,
    totalReleases,
    totalItems,
    totalValue: Math.round(totalValue * 100) / 100,
    currency,
    forceRefresh,
  };

  logger.info(`[${logLabel}] Complete: ${syncedReleases}/${totalReleases} releases synced (${syncedItems} items), ${skippedFresh} fresh, ${skippedNoData} no data, ${noDiscogsItems.length} no discogsId. Total value: ${totalValue.toFixed(2)} ${currency}`);

  return result;
}

/**
 * SSE wrapper around executePriceSync for direct HTTP streaming.
 */
export async function streamPriceSync(
  res: Response,
  items: PopulatedCollectionItem[],
  options?: {
    forceRefresh?: boolean;
    logLabel?: string;
  }
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  let isAborted = false;
  res.on('close', () => {
    isAborted = true;
  });

  const result = await executePriceSync(items, {
    forceRefresh: options?.forceRefresh,
    logLabel: options?.logLabel,
    onProgress: (event) => {
      if (!isAborted) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    },
    shouldAbort: () => isAborted,
  });

  if (!isAborted) {
    res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
    res.end();
  }

  return !isAborted;
}

// ===== CSV Import =====

export async function downloadTemplate(req: Request, res: Response) {
  const headers = [
    'Artist',
    'Album',
    'Format (Vinyl or CD)',
    'Year (Optional)',
    'Release ID (Optional)',
    'Catalog Number (Optional)',
    'Label (Optional)',
    'Genres (Optional)',
    'Value (Optional)',
    'Tracklist (Optional)',
    'Manual (Optional)',
    'Media Condition (Optional)',
    'Sleeve Condition (Optional)',
    'Cover Base64 (Optional)'
  ];

  const rows = [
    ['Daft Punk', 'Discovery', 'Vinyl', '2001', '', '', '', '', '', '', '', '', '', ''],
    ['Radiohead', 'OK Computer', 'CD', '1997', '1252837', 'CDNODATA 29', 'Parlophone', 'Alternative Rock', '', '', '', 'NM', 'VG+', ''],
    ['Pink Floyd', 'The Dark Side Of The Moon', 'Vinyl', '1973', '249504', '', 'Harvest', 'Psychedelic Rock', '', '', '', '', '', ''],
    ['Local Band', 'Live at Home', 'Cassette', '2020', '', '', 'Self-released', 'Rock', '12.50', '[]', 'true', '', '', '']
  ];

  const escape = (value: string) => /[",\n\r]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;

  const csvContent = [headers, ...rows]
    .map(columns => columns.map(escape).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="musivault_import_template.csv"');
  res.status(200).send(csvContent);
}

export async function exportCollectionCSV(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const csvContent = await csvExportService.buildCollectionCsv(req.user._id);
    // Date and time, so several exports in one day keep separate files.
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    const safeUsername = String(req.user.username || 'collection').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `musivault_${safeUsername}_${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM so Excel opens accented artist names correctly.
    res.status(200).send('﻿' + csvContent);
  } catch (error) {
    logger.error({ err: error }, 'Error exporting collection CSV');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function importCollectionCSV(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ message: 'Missing CSV file. Form field name must be "file".' });
      return;
    }

    const result = await csvImportService.importFromCsv(
      file.buffer,
      req.user._id,
      file.originalname
    );

    res.status(202).json({
      message: `Import started with ${result.totalRows} rows`,
      logId: result.logId,
      totalRows: result.totalRows,
      status: 'processing'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error starting CSV import');
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Import Logs =====

export async function getImportLogs(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const logs = await csvImportService.getImportLogs(req.user._id, limit);
    res.status(200).json(logs);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching import logs');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getImportLogById(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { logId } = req.params;
    const log = await csvImportService.getImportLogById(logId, req.user._id);

    if (!log) {
      res.status(404).json({ message: 'Import log not found' });
      return;
    }

    res.status(200).json(log);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching import log');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function downloadImportLog(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { logId } = req.params;
    const log = await csvImportService.getImportLogById(logId, req.user._id);

    if (!log) {
      res.status(404).json({ message: 'Import log not found' });
      return;
    }

    // Format the log for download
    const downloadData = {
      importedAt: log.importedAt,
      fileName: log.fileName,
      summary: {
        totalRows: log.totalRows,
        successCount: log.successCount,
        failCount: log.failCount,
        skipCount: log.skipCount
      },
      entries: log.entries
    };

    const filename = `import_log_${logId}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(downloadData, null, 2));
  } catch (error) {
    logger.error({ err: error }, 'Error downloading import log');
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Collection CRUD =====

export async function getMyCollection(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { sort, limit, style } = req.query;
    let query = CollectionItem.find({ user: req.user._id })
      .populate<{ album: IAlbum }>('album');

    if (sort === 'latest') {
      query = query.sort({ addedAt: -1 });
    }

    if (limit) {
      const numLimit = parseInt(limit as string, 10);
      if (!isNaN(numLimit)) {
        query = query.limit(numLimit);
      }
    }

    let collection = await query.exec();
    // Local edits live on the item, not on the shared album: lay them over the
    // populated album before filtering, sorting and replying.
    collection = applyAlbumOverridesToAll(collection);

    // Filter by style if provided
    if (style && typeof style === 'string') {
      collection = collection.filter(item =>
        item.album && item.album.styles && item.album.styles.includes(style)
      );
    }

    // Sort by artist if not sorting by latest
    if (sort !== 'latest') {
      collection.sort((a, b) => {
        if (a.album && b.album) {
          return a.album.artist.localeCompare(b.album.artist);
        }
        return 0;
      });
    }

    res.status(200).json(collection);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching collection');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getCollectionItemById(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await CollectionItem.findOne({
      _id: itemId,
      user: req.user._id
    }).populate('album');

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.status(200).json(applyAlbumOverrides(item));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching collection item');
    res.status(500).json({ error: 'Failed to fetch collection item' });
  }
}

export async function addToCollection(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { discogsId, title, artist, year, thumb, cover_image, format, genres, styles, tracklist, labels, mediaCondition, sleeveCondition } = req.body as AddToCollectionBody;

    // Find or create album
    let album = await Album.findOne({ discogsId });
    if (!album) {
      // Discogs only serves remote images; keep a local copy so the cover
      // survives a changed URL and can go into the CSV backup.
      const localCover = await downloadCoverToLocal(cover_image || thumb, 'Discogs cover');
      album = new Album({
        discogsId,
        title,
        artist: stripArtistSuffixes(artist),
        year,
        thumb: localCover || thumb,
        cover_image: localCover || cover_image,
        genres: genres || [],
        styles: styles || [],
        tracklist: tracklist || [],
        labels: labels || []
      });
      await album.save();
    } else if (album.cover_image && /^https?:\/\//i.test(album.cover_image)) {
      // Albums added before covers were copied locally still point at Discogs.
      // Copy them once, on the next add, instead of on every read.
      const localized = await downloadCoverToLocal(album.cover_image, 'Discogs cover');
      if (localized !== album.cover_image) {
        album.cover_image = localized;
        album.thumb = localized;
        await album.save();
      }
    }

    // Check for duplicate
    const existingItem = await CollectionItem.findOne({
      user: req.user._id,
      album: album._id,
      format: format
    });

    if (existingItem) {
      res.status(409).json({ message: 'You already have this album in this format.' });
      return;
    }

    // Create collection item
    const priceStats = discogsId ? await getMarketplaceStats(discogsId) : null;

    const newItem = new CollectionItem({
      user: req.user._id,
      album: album._id,
      format: format,
      mediaCondition: mediaCondition || null,
      sleeveCondition: sleeveCondition || null,
      priceCache: buildPriceCache(priceStats),
    });
    await newItem.save();

    res.status(201).json({ message: 'Album added to your collection!', item: newItem });
  } catch (error) {
    logger.error({ err: error }, 'Error adding to collection');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteFromCollection(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const itemToDelete = await CollectionItem.findOneAndDelete({
      _id: itemId,
      user: req.user._id
    });

    if (!itemToDelete) {
      res.status(404).json({ message: 'Item not found in your collection.' });
      return;
    }

    // A cover uploaded for a local edit belongs to this item alone.
    await removeStoredCover(itemToDelete.albumOverrides?.cover_image);

    res.status(200).json({ message: 'Album removed from your collection.' });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting from collection');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateCollectionItem(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const { format, mediaCondition, sleeveCondition, customFields } = req.body;

    if (format !== undefined) {
      res.status(400).json({ message: 'Manual format updates are not supported. Please use rematch instead.' });
      return;
    }

    // Build update object dynamically
    const updateFields: Record<string, unknown> = {};

    if (mediaCondition !== undefined) {
      updateFields["mediaCondition"] = mediaCondition;
    }

    if (sleeveCondition !== undefined) {
      updateFields["sleeveCondition"] = sleeveCondition;
    }

    if (customFields !== undefined) {
      if (typeof customFields !== 'object' || customFields === null || Array.isArray(customFields)) {
        res.status(400).json({ message: 'customFields must be an object' });
        return;
      }

      const validation = await validateCustomFieldValues(
        req.user._id.toString(),
        customFields as Record<string, string>
      );

      if (!validation.valid) {
        res.status(400).json({ message: validation.error });
        return;
      }

      updateFields["customFields"] = validation.sanitized;
    }

    // Require at least one field to update
    if (Object.keys(updateFields).length === 0) {
      res.status(400).json({ message: "No valid fields to update" });
      return;
    }

    const updatedItem = await CollectionItem.findOneAndUpdate(
      { _id: itemId, user: req.user._id },
      { $set: updateFields },
      { new: true }
    );

    if (!updatedItem) {
      res.status(404).json({ message: 'Item not found in your collection' });
      return;
    }

    res.status(200).json(updatedItem);
  } catch (error) {
    logger.error({ err: error }, 'Error updating collection item');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function ignoreFormatVerificationAlert(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await CollectionItem.findOne({
      _id: itemId,
      user: req.user._id
    }).populate('album');

    if (!item) {
      res.status(404).json({ message: 'Item not found in your collection' });
      return;
    }

    if (!item.formatVerification || item.formatVerification.status === 'match') {
      res.status(400).json({ message: 'No active format verification alert to ignore' });
      return;
    }

    item.formatVerification.ignoredAt = new Date();
    await item.save();

    res.status(200).json(applyAlbumOverrides(item));
  } catch (error) {
    logger.error({ err: error }, 'Error ignoring format verification alert');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function restoreFormatVerificationAlert(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await CollectionItem.findOne({
      _id: itemId,
      user: req.user._id
    }).populate('album');

    if (!item) {
      res.status(404).json({ message: 'Item not found in your collection' });
      return;
    }

    if (!item.formatVerification || item.formatVerification.status === 'match' || !item.formatVerification.ignoredAt) {
      res.status(400).json({ message: 'No ignored format verification alert to restore' });
      return;
    }

    item.formatVerification.ignoredAt = null;
    await item.save();

    res.status(200).json(applyAlbumOverrides(item));
  } catch (error) {
    logger.error({ err: error }, 'Error restoring format verification alert');
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Album Rematch =====

export async function rematchAlbum(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const { newDiscogsId, format } = req.body;

    if (!newDiscogsId || typeof newDiscogsId !== 'number') {
      res.status(400).json({ message: 'newDiscogsId is required and must be a number' });
      return;
    }

    // Find the collection item
    const item = await CollectionItem.findOne({
      _id: itemId,
      user: req.user._id
    }).populate('album');

    if (!item) {
      res.status(404).json({ message: 'Item not found in your collection' });
      return;
    }

    const releaseData = await discogsRequest<DiscogsReleaseResponse>(`/releases/${newDiscogsId}`);

    // Update the album with new Discogs data
    const album = item.album as any;
    const mapped = mapReleaseToAlbumUpdate(releaseData, album);
    const localCover = await downloadCoverToLocal(mapped.cover_image || mapped.thumb, 'Discogs cover');
    album.discogsId = newDiscogsId;
    Object.assign(album, {
      ...mapped,
      cover_image: localCover || mapped.cover_image,
      thumb: localCover || mapped.thumb
    });

    if (format?.name) {
      item.format = {
        name: format.name,
        descriptions: format.descriptions || [],
        text: format.text || ''
      };
    }

    item.formatVerification = null;
    item.priceCache = buildPriceCache(await getMarketplaceStats(newDiscogsId));

    // Rematching replaces the edition, so edits made to the old one no longer apply.
    await clearAlbumOverrides(item, album.cover_image);

    await album.save();
    await item.save();

    // Return the updated item
    const updatedItem = await CollectionItem.findById(itemId).populate('album');
    res.status(200).json(updatedItem ? applyAlbumOverrides(updatedItem) : updatedItem);
  } catch (error: any) {
    logger.error({ err: error }, 'Error rematching album');
    if (error.response?.status === 404) {
      res.status(404).json({ message: 'Release not found on Discogs' });
      return;
    }
    if (error.response?.status === 429) {
      res.status(429).json({ message: 'Too many requests! Please wait about 30 seconds before trying again.' });
      return;
    }
    // MongoDB duplicate key error - album already exists in collection
    if (error.code === 11000) {
      res.status(409).json({ message: 'This album already exists in your collection' });
      return;
    }
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Album Refresh =====

/** Album fields a refresh can change, in the order they are reported back. */
const REFRESHABLE_ALBUM_FIELDS = ['title', 'artist', 'year', 'cover_image', 'thumb', 'genres', 'styles', 'tracklist', 'labels'] as const;

/**
 * Re-read a single album from its Discogs release and update what changed (title, artist, year,
 * images, styles, tracklist, labels, and the format's details), the way the price sync does for prices.
 * Everything that belongs to the user's copy is left alone: condition, notes, custom fields,
 * added date, price, and the format itself. A tracklist or labels the release no longer lists are kept.
 * Replies with the updated item and `changed`, the names of the fields that differed (empty = up to date).
 * The album is shared with every user who owns that release, so they see the update too.
 */
export async function refreshItemFromDiscogs(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await CollectionItem.findOne({ _id: itemId, user: req.user._id })
      .populate<{ album: IAlbum }>('album');

    if (!item) {
      res.status(404).json({ message: 'Item not found in your collection' });
      return;
    }

    const album = item.album;
    if (!album || !album.discogsId) {
      res.status(400).json({ message: 'Cannot refresh: No Discogs ID associated with this album' });
      return;
    }

    const release = await discogsRequest<DiscogsReleaseResponse>(`/releases/${album.discogsId}`);
    const fromRelease = mapReleaseToAlbumUpdate(release, album);
    const localCover = await downloadCoverToLocal(fromRelease.cover_image || fromRelease.thumb, 'Discogs cover');
    // A release that lists no tracks or labels is more likely incomplete data than a real removal.
    const update = {
      ...fromRelease,
      cover_image: localCover || fromRelease.cover_image,
      thumb: localCover || fromRelease.thumb,
      tracklist: fromRelease.tracklist.length > 0 ? fromRelease.tracklist : album.tracklist,
      labels: fromRelease.labels.length > 0 ? fromRelease.labels : album.labels
    };

    const changed = REFRESHABLE_ALBUM_FIELDS.filter(
      field => JSON.stringify(update[field]) !== JSON.stringify(album.toObject()[field])
    );
    Object.assign(album, update);

    const formatDetails = release.formats?.find(f => f.name.toLowerCase() === item.format.name.toLowerCase());
    const descriptions = formatDetails?.descriptions || [];
    const text = formatDetails?.text || '';
    const formatChanged = !!formatDetails && (
      text !== item.format.text || JSON.stringify(descriptions) !== JSON.stringify(item.format.descriptions)
    );
    if (formatChanged) {
      item.format.descriptions = descriptions;
      item.format.text = text;
    }

    // The refresh overwrites the local edits after the user confirmed it.
    const overridesCleared = await clearAlbumOverrides(item, album.cover_image);

    if (changed.length > 0) await album.save();
    if (formatChanged || overridesCleared) await item.save();

    const updatedItem = await CollectionItem.findById(itemId).populate('album');
    res.status(200).json({
      item: updatedItem ? applyAlbumOverrides(updatedItem) : updatedItem,
      changed: formatChanged ? [...changed, 'format'] : changed
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      res.status(404).json({ message: 'Release not found on Discogs' });
      return;
    }
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      res.status(429).json({ message: 'Too many requests! Please wait about 30 seconds before trying again.' });
      return;
    }
    logger.error({ err: error }, 'Error refreshing album from Discogs');
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Style Filter =====

export async function getStyles(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const styles = await getUserStyles(req.user._id);

    res.status(200).json(styles);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching styles');
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Manual Album Entry =====

interface ManualAlbumBody {
  title?: string;
  artist?: string;
  year?: string;
  format?: string;
  /** Free-text label name; the catalog number is a separate field. */
  label?: string;
  catno?: string;
  /** Comma- or semicolon-separated list, stored on the album as styles. */
  genres?: string;
  /** Hand-entered value in USD. */
  value?: string;
  /** JSON array of { position, title, duration, artist }. */
  tracklist?: string;
  /** JSON object of custom field id -> value, from the form's own fields. */
  customFields?: string;
  /** 'true' clears the existing cover during an edit. */
  removeCover?: string;
}

function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseManualGenres(raw: unknown): string[] {
  const value = trimmedString(raw);
  if (!value) return [];
  return Array.from(new Set(
    value.split(/[,;]/).map(part => part.trim()).filter(Boolean)
  ));
}

function parseManualLabels(rawLabel: unknown, rawCatno: unknown): ILabel[] {
  const name = trimmedString(rawLabel);
  if (!name) return [];
  return [{ name, catno: trimmedString(rawCatno) }];
}

/** `null` means malformed input; an array (possibly empty) is valid. */
function parseManualTracklist(raw: unknown): ITrack[] | null {
  const value = trimmedString(raw);
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  return parsed
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map(entry => ({
      position: trimmedString(entry.position),
      title: trimmedString(entry.title),
      duration: trimmedString(entry.duration),
      artist: trimmedString(entry.artist)
    }))
    .filter(track => track.position || track.title || track.duration || track.artist);
}

/**
 * `undefined` when the field was not sent, `null` when it should be cleared.
 * Throws on malformed amounts so the caller can reply with a 400.
 */
function parseManualValue(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  const value = trimmedString(raw);
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Value must be a valid positive number');
  }
  return Math.round(amount * 100) / 100;
}

/**
 * Custom field values arrive as a JSON object from the manual form, keyed by
 * definition id. `null` means malformed input; blank values are dropped so the
 * saved map only holds actual answers.
 */
function parseManualCustomFields(raw: unknown): Record<string, string> | null {
  const value = trimmedString(raw);
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const values: Record<string, string> = {};
  for (const [fieldId, fieldValue] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof fieldValue !== 'string') return null;
    const trimmed = fieldValue.trim();
    if (trimmed) values[fieldId] = trimmed;
  }
  return values;
}

function manualCoverPath(file: Express.Multer.File | undefined): string {
  return file ? `/uploads/covers/${file.filename}` : '';
}

/** Keep the uploads directory tidy when a manual cover is replaced or cleared. */
async function removeStoredCover(coverPath: string | null | undefined): Promise<void> {
  if (!coverPath || !coverPath.startsWith('/uploads/covers/')) return;
  const filename = path.basename(coverPath);
  try {
    await fs.promises.unlink(path.join(COVERS_DIR, filename));
  } catch (err) {
    logger.warn({ err, coverPath }, '[ManualAlbum] Could not remove old cover');
  }
}

/**
 * Drop every local album edit and return whether there was one. The cover the
 * user uploaded is deleted unless the shared album now uses the same file.
 * The caller saves the collection item.
 */
async function clearAlbumOverrides(
  item: { albumOverrides?: IAlbumOverrides | null; locallyModified?: boolean },
  baseCover: string | null | undefined
): Promise<boolean> {
  if (!hasAlbumOverrides(item.albumOverrides) && !item.locallyModified) return false;

  const overrideCover = item.albumOverrides?.cover_image;
  if (overrideCover && overrideCover !== baseCover) {
    await removeStoredCover(overrideCover);
  }

  item.albumOverrides = null;
  item.locallyModified = false;
  return true;
}

export async function addManualAlbum(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const body = req.body as ManualAlbumBody;
    const title = trimmedString(body.title);
    const artist = trimmedString(body.artist);
    const format = trimmedString(body.format);

    // Validate required fields
    if (!title || !artist || !format) {
      res.status(400).json({ message: 'Title, artist, and format are required' });
      return;
    }

    const tracklist = parseManualTracklist(body.tracklist);
    if (tracklist === null) {
      res.status(400).json({ message: 'Tracklist must be a valid list of tracks' });
      return;
    }

    let manualValue: number | null;
    try {
      manualValue = parseManualValue(body.value) ?? null;
    } catch {
      res.status(400).json({ message: 'Value must be a valid positive number' });
      return;
    }

    const customFields = parseManualCustomFields(body.customFields);
    if (customFields === null) {
      res.status(400).json({ message: 'Custom fields must be a valid object' });
      return;
    }

    const customFieldValidation = await validateCustomFieldValues(
      req.user._id.toString(),
      customFields
    );
    if (!customFieldValidation.valid) {
      res.status(400).json({ message: customFieldValidation.error });
      return;
    }

    // Handle cover image if uploaded
    const coverImagePath = manualCoverPath((req as any).file as Express.Multer.File | undefined);

    // Create manual album
    const album = new Album({
      isManual: true,
      title,
      artist,
      year: trimmedString(body.year),
      thumb: coverImagePath,
      cover_image: coverImagePath,
      styles: parseManualGenres(body.genres),
      tracklist,
      labels: parseManualLabels(body.label, body.catno)
    });
    await album.save();

    // Create collection item
    const newItem = new CollectionItem({
      user: req.user._id,
      album: album._id,
      format: {
        name: format,
        descriptions: [],
        text: format
      },
      manualValue,
      customFields: customFieldValidation.sanitized ?? {}
    });
    await newItem.save();

    res.status(201).json({
      message: 'Manual album added to your collection!',
      item: newItem,
      album: album
    });
  } catch (error) {
    logger.error({ err: error }, 'Error adding manual album');
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Edit a hand-added album and the user's copy of it: title, artist, year,
 * format, label, genres, value, tracklist and cover. Discogs albums are left
 * alone — their metadata is refreshed or rematched, never hand-edited.
 */
export async function updateManualAlbum(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await CollectionItem.findOne({ _id: itemId, user: req.user._id })
      .populate<{ album: IAlbum }>('album');

    if (!item) {
      res.status(404).json({ message: 'Item not found in your collection' });
      return;
    }

    const album = item.album;
    if (!album || !album.isManual) {
      res.status(400).json({ message: 'Only manually added albums can be edited' });
      return;
    }

    const body = req.body as ManualAlbumBody;
    const title = body.title !== undefined ? trimmedString(body.title) : album.title;
    const artist = body.artist !== undefined ? trimmedString(body.artist) : album.artist;
    const format = body.format !== undefined ? trimmedString(body.format) : item.format.name;

    if (!title || !artist || !format) {
      res.status(400).json({ message: 'Title, artist, and format are required' });
      return;
    }

    if (body.tracklist !== undefined) {
      const tracklist = parseManualTracklist(body.tracklist);
      if (tracklist === null) {
        res.status(400).json({ message: 'Tracklist must be a valid list of tracks' });
        return;
      }
      album.tracklist = tracklist;
    }

    if (body.value !== undefined) {
      try {
        item.manualValue = parseManualValue(body.value) ?? null;
      } catch {
        res.status(400).json({ message: 'Value must be a valid positive number' });
        return;
      }
    }

    if (body.customFields !== undefined) {
      const customFields = parseManualCustomFields(body.customFields);
      if (customFields === null) {
        res.status(400).json({ message: 'Custom fields must be a valid object' });
        return;
      }

      const validation = await validateCustomFieldValues(req.user._id.toString(), customFields);
      if (!validation.valid) {
        res.status(400).json({ message: validation.error });
        return;
      }

      item.customFields = new Map(Object.entries(validation.sanitized ?? {}));
    }

    if (body.title !== undefined) album.title = title;
    if (body.artist !== undefined) album.artist = artist;
    if (body.year !== undefined) album.year = trimmedString(body.year);
    if (body.genres !== undefined) album.styles = parseManualGenres(body.genres);
    if (body.label !== undefined) album.labels = parseManualLabels(body.label, body.catno);

    if (body.format !== undefined && format !== item.format.name) {
      item.format = { name: format, descriptions: [], text: format };
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      const newCover = manualCoverPath(file);
      await removeStoredCover(album.cover_image);
      album.cover_image = newCover;
      album.thumb = newCover;
    } else if (trimmedString(body.removeCover) === 'true') {
      await removeStoredCover(album.cover_image);
      album.cover_image = '';
      album.thumb = '';
    }

    await album.save();
    await item.save();

    const updatedItem = await CollectionItem.findById(item._id).populate('album');
    res.status(200).json({ message: 'Manual album updated!', item: updatedItem });
  } catch (error) {
    logger.error({ err: error }, 'Error updating manual album');
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Discogs Album Local Edits =====

interface DiscogsAlbumBody {
  title?: string;
  artist?: string;
  year?: string;
  /** Free-text label name; the catalog number is a separate field. */
  label?: string;
  catno?: string;
  /** Comma- or semicolon-separated list, stored on the album as styles. */
  genres?: string;
  /** JSON array of { position, title, duration, artist }. */
  tracklist?: string;
  /** 'true' clears the album cover for this user. */
  removeCover?: string;
}

/**
 * Edit the metadata of a Discogs album on this user's copy only. The shared
 * Album document belongs to every user who owns the release, so the changes are
 * stored as albumOverrides on the collection item and laid over the album when
 * the item is read. The format is not editable: rematch handles that.
 */
export async function updateDiscogsAlbum(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await CollectionItem.findOne({ _id: itemId, user: req.user._id })
      .populate<{ album: IAlbum }>('album');

    if (!item) {
      res.status(404).json({ message: 'Item not found in your collection' });
      return;
    }

    const album = item.album;
    if (!album) {
      res.status(404).json({ message: 'Album not found' });
      return;
    }
    if (album.isManual) {
      res.status(400).json({ message: 'Manual albums are edited with the manual album endpoint' });
      return;
    }

    const body = req.body as DiscogsAlbumBody;
    const base = album.toObject() as IAlbum;
    const current = mergeAlbumOverrides(base, item.albumOverrides);
    const desired: IAlbumOverrides = {};

    if (body.title !== undefined) {
      const title = trimmedString(body.title);
      if (!title) {
        res.status(400).json({ message: 'Title is required' });
        return;
      }
      desired.title = title;
    }

    if (body.artist !== undefined) {
      const artist = trimmedString(body.artist);
      if (!artist) {
        res.status(400).json({ message: 'Artist is required' });
        return;
      }
      desired.artist = artist;
    }

    if (body.year !== undefined) desired.year = trimmedString(body.year);
    if (body.genres !== undefined) desired.styles = parseManualGenres(body.genres);

    if (body.tracklist !== undefined) {
      const tracklist = parseManualTracklist(body.tracklist);
      if (tracklist === null) {
        res.status(400).json({ message: 'Tracklist must be a valid list of tracks' });
        return;
      }
      desired.tracklist = tracklist;
    }

    if (body.label !== undefined || body.catno !== undefined) {
      const name = trimmedString(body.label);
      const catno = trimmedString(body.catno);
      const currentLabels = current.labels || [];
      const first = currentLabels[0];
      const rest = currentLabels.slice(1);

      if (name) {
        const label: ILabel = { name, catno };
        // Keep the Discogs id when the edited label is still the same one, so
        // the label link keeps working.
        if (first && first.name === name && first.catno === catno && first.discogsId !== undefined) {
          label.discogsId = first.discogsId;
        }
        desired.labels = [label, ...rest];
      } else {
        desired.labels = rest;
      }
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      const newCover = manualCoverPath(file);
      const previousOverrideCover = item.albumOverrides?.cover_image;
      if (previousOverrideCover && previousOverrideCover !== base.cover_image && previousOverrideCover !== newCover) {
        await removeStoredCover(previousOverrideCover);
      }
      desired.cover_image = newCover;
      desired.thumb = newCover;
    } else if (trimmedString(body.removeCover) === 'true') {
      const previousOverrideCover = item.albumOverrides?.cover_image;
      if (previousOverrideCover && previousOverrideCover !== base.cover_image) {
        await removeStoredCover(previousOverrideCover);
      }
      desired.cover_image = '';
      desired.thumb = '';
    }

    const overrides = buildAlbumOverrides(base, item.albumOverrides, desired);
    item.albumOverrides = overrides;
    item.locallyModified = hasAlbumOverrides(overrides);
    await item.save();

    const updatedItem = await CollectionItem.findById(item._id).populate('album');
    res.status(200).json({
      message: 'Album updated!',
      item: updatedItem ? applyAlbumOverrides(updatedItem) : updatedItem
    });
  } catch (error) {
    logger.error({ err: error }, 'Error updating Discogs album');
    res.status(500).json({ message: 'Internal server error' });
  }
}

/** Drop this user's local edits and show the shared Discogs album again. */
export async function restoreDiscogsAlbum(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await CollectionItem.findOne({ _id: itemId, user: req.user._id })
      .populate<{ album: IAlbum }>('album');

    if (!item) {
      res.status(404).json({ message: 'Item not found in your collection' });
      return;
    }

    const album = item.album;
    if (!album || album.isManual) {
      res.status(400).json({ message: 'Only Discogs albums have Discogs data to restore' });
      return;
    }

    const restored = await clearAlbumOverrides(item, album.cover_image);
    if (restored) await item.save();

    const updatedItem = await CollectionItem.findById(item._id).populate('album');
    res.status(200).json({
      message: restored ? 'Discogs data restored' : 'No local changes to restore',
      item: updatedItem ? applyAlbumOverrides(updatedItem) : updatedItem,
      restored
    });
  } catch (error) {
    logger.error({ err: error }, 'Error restoring Discogs album');
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Collection Value Sync =====

/**
 * Fetch and store the price for a single collection item (fire-and-forget helper)
 */
async function fetchPriceForItem(itemId: string, discogsId: number): Promise<void> {
  try {
    const stats = await getMarketplaceStats(discogsId);
    if (stats) {
      await CollectionItem.findByIdAndUpdate(itemId, {
        $set: {
          priceCache: {
            mint: stats.mint,
            nearMint: stats.nearMint,
            veryGoodPlus: stats.veryGoodPlus,
            veryGood: stats.veryGood,
            goodPlus: stats.goodPlus,
            good: stats.good,
            fair: stats.fair,
            poor: stats.poor,
            currency: stats.currency,
            updatedAt: new Date(),
          }
        }
      });
    }
  } catch (err) {
    logger.error({ err }, `[PriceSync] Error fetching price for item ${itemId}`);
  }
}

export async function getCollectionSyncInfo(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const collectionItems = await CollectionItem.find({ user: req.user._id })
      .select('priceCache album')
      .populate<{ album: Pick<IAlbum, 'discogsId'> }>('album', 'discogsId');

    // Use the last admin task execution for refresh-prices to compute next sync
    const lastExecution = await AdminTaskExecution.findOne({ taskId: 'refresh-prices' })
      .sort({ executedAt: -1 })
      .lean();

    let nextAutoSyncAt: Date | null = null;
    if (lastExecution?.executedAt) {
      const ttlMs = getPriceTTLHours() * 60 * 60 * 1000;
      let ts = new Date(lastExecution.executedAt).getTime();
      const now = Date.now();
      while (ts <= now) {
        ts += ttlMs;
      }
      nextAutoSyncAt = new Date(ts);
    }

    const lastSyncedAt = collectionItems.reduce<Date | null>((latest, item) => {
      const updatedAt = item.priceCache?.updatedAt ? new Date(item.priceCache.updatedAt) : null;
      if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
        return latest;
      }
      if (!latest || updatedAt.getTime() > latest.getTime()) {
        return updatedAt;
      }
      return latest;
    }, null);

    res.status(200).json({
      nextAutoSyncAt: nextAutoSyncAt?.toISOString() ?? null,
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      ttlHours: getPriceTTLHours(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching collection sync info');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getCollectionValueHistory(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Refresh the current day before reading. The series is otherwise written
    // only by the price sync task, and this is what makes an add, a delete or a
    // manual sync show up straight away without instrumenting those mutations.
    // It writes nothing when the total is unchanged.
    await recordValueSnapshot(req.user._id);

    res.status(200).json(await getValueHistory(req.user._id));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching collection value history');
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function syncItemPrice(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const item = await CollectionItem.findOne({ _id: itemId, user: req.user._id })
      .populate<{ album: IAlbum }>('album');

    if (!item) {
      res.status(404).json({ message: 'Item not found in your collection' });
      return;
    }

    if (!item.album || !item.album.discogsId) {
      res.status(400).json({ message: 'Cannot sync price: No Discogs ID associated with this album' });
      return;
    }

    const stats = await getMarketplaceStats(item.album.discogsId, { forceRefresh: true });

    if (stats) {
      item.priceCache = {
        mint: stats.mint ?? undefined,
        nearMint: stats.nearMint ?? undefined,
        veryGoodPlus: stats.veryGoodPlus ?? undefined,
        veryGood: stats.veryGood ?? undefined,
        goodPlus: stats.goodPlus ?? undefined,
        good: stats.good ?? undefined,
        fair: stats.fair ?? undefined,
        poor: stats.poor ?? undefined,
        currency: stats.currency,
        updatedAt: new Date(),
      };
      await item.save();
      
      res.status(200).json({ 
        message: 'Price updated successfully', 
        priceCache: item.priceCache,
        value: getValueForItem(item)
      });
    } else {
      res.status(404).json({ message: 'No price data found for this album on Discogs' });
    }
  } catch (error) {
    logger.error({ err: error }, `Error syncing price for item ${req.params?.itemId}`);
    res.status(500).json({ message: 'Internal server error while syncing price' });
  }
}

export { fetchPriceForItem, getValueForItem };
