import { Request, Response } from 'express';
import type { Express } from 'express';
import Album, { IAlbum, ITrack, ILabel } from '../models/Album';
import CollectionItem, { ICollectionItem } from '../models/CollectionItem';
import { csvImportService } from '../services/import.service';
import { getMarketplaceStats } from '../services/discogs.service';
import { getPriceTTLHours, isPriceStale } from '../utils/price.utils';
import { cleanAlbumTitle, discogsRequest } from '../utils/discogs.utils';
import type { DiscogsReleaseResponse } from '../types/discogs.types';

// ===== Types =====

type AddToCollectionBody = {
  discogsId: number;
  title: string;
  artist: string;
  year: string;
  thumb: string;
  cover_image: string;
  format: ICollectionItem['format'];
  styles?: string[];
  tracklist?: ITrack[];
  labels?: ILabel[];
  mediaCondition?: string;
  sleeveCondition?: string;
};

export type PopulatedCollectionItem = ICollectionItem & {
  album: IAlbum;
};

type SyncableCollectionItem = {
  album?: Pick<IAlbum, 'discogsId'> | null;
  priceCache?: {
    updatedAt?: Date | string | null;
  } | null;
};

function buildPriceCache(stats: Awaited<ReturnType<typeof getMarketplaceStats>>) {
  if (!stats) return undefined;

  return {
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
}

export function getNextAutoSyncAt(items: SyncableCollectionItem[]): Date | null {
  const ttlMs = getPriceTTLHours() * 60 * 60 * 1000;
  const now = Date.now();
  let nextAutoSyncAt: number | null = null;

  for (const item of items) {
    if (!item.album?.discogsId) {
      continue;
    }

    const updatedAt = item.priceCache?.updatedAt
      ? new Date(item.priceCache.updatedAt).getTime()
      : NaN;

    const candidate = Number.isFinite(updatedAt) ? updatedAt + ttlMs : now;
    nextAutoSyncAt = nextAutoSyncAt === null
      ? candidate
      : Math.min(nextAutoSyncAt, candidate);
  }

  return nextAutoSyncAt === null ? null : new Date(nextAutoSyncAt);
}

export async function streamPriceSync(
  res: Response,
  items: PopulatedCollectionItem[],
  options?: {
    forceRefresh?: boolean;
    logLabel?: string;
  }
) {
  const forceRefresh = options?.forceRefresh ?? false;
  const logLabel = options?.logLabel ?? 'PriceSync';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

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

  console.log(`[${logLabel}] Starting sync: ${totalItems} items, ${totalReleases} unique releases, ${noDiscogsItems.length} without discogsId, forceRefresh=${forceRefresh}`);

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

    res.write(`data: ${JSON.stringify({
      type: 'progress',
      current: releaseIdx,
      total: totalReleases,
      artist,
      title,
      itemCount: releaseItems.length,
    })}\n\n`);

    const stats = await getMarketplaceStats(discogsId);

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
      console.log(`[${logLabel}] ${releaseIdx}/${totalReleases} SUCCESS - ${artist} - ${title} (${releaseItems.length} items) | VG+: ${stats.veryGoodPlus} ${stats.currency}`);
    } else {
      skippedNoData += releaseItems.length;
      console.log(`[${logLabel}] ${releaseIdx}/${totalReleases} NO DATA - ${artist} - ${title}`);
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

  console.log(`[${logLabel}] Complete: ${syncedReleases}/${totalReleases} releases synced (${syncedItems} items), ${skippedFresh} fresh, ${skippedNoData} no data, ${noDiscogsItems.length} no discogsId. Total value: ${totalValue.toFixed(2)} ${currency}`);

  const summaryMessage = forceRefresh
    ? `Refreshed ${syncedReleases} releases (${syncedItems} items).`
    : `Synced ${syncedReleases} releases (${syncedItems} items). ${skippedFresh} already fresh.`;

  res.write(`data: ${JSON.stringify({
    type: 'complete',
    synced: syncedItems,
    skipped: skippedFresh + skippedNoData + noDiscogsItems.length,
    total: totalItems,
    totalValue: Math.round(totalValue * 100) / 100,
    currency,
    message: summaryMessage,
  })}\n\n`);

  res.end();
}

// ===== CSV Import =====

export async function downloadTemplate(req: Request, res: Response) {
  const csvContent = [
    'Artist,Album,Year (Optional),Format (Vinyl or CD),Release ID (Optional),Catalog Number (Optional)',
    'Daft Punk,Discovery,2001,Vinyl,,',
    'Radiohead,OK Computer,1997,CD,1252837,CDNODATA 29',
    'Pink Floyd,The Dark Side Of The Moon,1973,Vinyl,249504,'
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="musivault_import_template.csv"');
  res.status(200).send(csvContent);
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
    console.error('Error starting CSV import:', error);
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
    console.error('Error fetching import logs:', error);
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
    console.error('Error fetching import log:', error);
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
    console.error('Error downloading import log:', error);
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
    console.error('Error fetching collection:', error);
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

    res.status(200).json(item);
  } catch (error) {
    console.error('Error fetching collection item:', error);
    res.status(500).json({ error: 'Failed to fetch collection item' });
  }
}

export async function addToCollection(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { discogsId, title, artist, year, thumb, cover_image, format, styles, tracklist, labels, mediaCondition, sleeveCondition } = req.body as AddToCollectionBody;

    // Find or create album
    let album = await Album.findOne({ discogsId });
    if (!album) {
      album = new Album({
        discogsId,
        title,
        artist: artist.replace(/\s\(\d+\)$/, ''),
        year,
        thumb,
        cover_image,
        styles: styles || [],
        tracklist: tracklist || [],
        labels: labels || []
      });
      await album.save();
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
    console.error('Error adding to collection:', error);
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

    res.status(200).json({ message: 'Album removed from your collection.' });
  } catch (error) {
    console.error('Error deleting from collection:', error);
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
    const { format, mediaCondition, sleeveCondition } = req.body;

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
    console.error('Error updating collection item:', error);
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

    res.status(200).json(item);
  } catch (error) {
    console.error('Error ignoring format verification alert:', error);
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

    res.status(200).json(item);
  } catch (error) {
    console.error('Error restoring format verification alert:', error);
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
    const cleanedTitle = cleanAlbumTitle(releaseData.title);

    // Update the album with new Discogs data
    const album = item.album as any;
    album.discogsId = newDiscogsId;
    album.title = cleanedTitle;
    album.artist = (releaseData.artists?.map((a: any) => a.name).join(', ') || album.artist).replace(/\s\(\d+\)$/, '');
    album.year = releaseData.year?.toString() || album.year;
    album.cover_image = releaseData.images?.find((img: any) => img.type === 'primary')?.uri
      || releaseData.images?.[0]?.uri
      || album.cover_image;
    album.thumb = releaseData.images?.[0]?.uri150 || album.thumb;
    album.styles = releaseData.styles || album.styles;
    album.tracklist = releaseData.tracklist?.map((t: any) => ({
      position: t.position || '',
      title: t.title || '',
      duration: t.duration || '',
      artist: t.artists?.map((a: any) => a.name).join(', ') || ''
    })) || [];
    album.labels = releaseData.labels?.map((l: any) => ({
      name: l.name || '',
      catno: l.catno || ''
    })) || [];

    if (format?.name) {
      item.format = {
        name: format.name,
        descriptions: format.descriptions || [],
        text: format.text || ''
      };
    }

    item.formatVerification = null;
    item.priceCache = buildPriceCache(await getMarketplaceStats(newDiscogsId));

    await album.save();
    await item.save();

    // Return the updated item
    const updatedItem = await CollectionItem.findById(itemId).populate('album');
    res.status(200).json(updatedItem);
  } catch (error: any) {
    console.error('Error rematching album:', error);
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

// ===== Style Filter =====

export async function getStyles(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get all collection items for the user
    const collectionItems = await CollectionItem.find({ user: req.user._id }).populate<{ album: IAlbum }>('album');

    // Extract all unique styles
    const stylesSet = new Set<string>();
    for (const item of collectionItems) {
      if (item.album && item.album.styles) {
        for (const style of item.album.styles) {
          stylesSet.add(style);
        }
      }
    }

    // Convert to sorted array
    const styles = Array.from(stylesSet).sort();

    res.status(200).json(styles);
  } catch (error) {
    console.error('Error fetching styles:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Manual Album Entry =====

interface ManualAlbumBody {
  title: string;
  artist: string;
  year?: string;
  format: string;
}

export async function addManualAlbum(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { title, artist, year, format } = req.body as ManualAlbumBody;

    // Validate required fields
    if (!title || !artist || !format) {
      res.status(400).json({ message: 'Title, artist, and format are required' });
      return;
    }

    // Handle cover image if uploaded
    let coverImagePath = '';
    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      // The file path is relative to the uploads directory
      coverImagePath = `/uploads/covers/${file.filename}`;
    }

    // Create manual album
    const album = new Album({
      isManual: true,
      title: title.trim(),
      artist: artist.trim(),
      year: year?.trim() || '',
      thumb: coverImagePath,
      cover_image: coverImagePath,
      styles: [],
      tracklist: [],
      labels: []
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
      }
    });
    await newItem.save();

    res.status(201).json({
      message: 'Manual album added to your collection!',
      item: newItem,
      album: album
    });
  } catch (error) {
    console.error('Error adding manual album:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ===== Collection Value Sync =====

/**
 * Get the effective value for a collection item based on its media condition.
 * Matches the item's mediaCondition to the stored per-condition price.
 * Defaults to VG+ if no condition is set.
 */
function getValueForItem(item: any): number {
  if (!item.priceCache) return 0;
  const pc = item.priceCache;

  switch (item.mediaCondition) {
    case 'M': return pc.mint ?? pc.nearMint ?? 0;
    case 'NM': return pc.nearMint ?? pc.mint ?? 0;
    case 'VG+': return pc.veryGoodPlus ?? 0;
    case 'VG': return pc.veryGood ?? 0;
    case 'G+': return pc.goodPlus ?? 0;
    case 'G': return pc.good ?? 0;
    case 'F': return pc.fair ?? 0;
    case 'P': return pc.poor ?? 0;
    default: return pc.veryGoodPlus ?? pc.nearMint ?? 0; // default to VG+
  }
}

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
    console.error(`[PriceSync] Error fetching price for item ${itemId}:`, err);
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

    const nextAutoSyncAt = getNextAutoSyncAt(collectionItems);
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
    console.error('Error fetching collection sync info:', error);
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

    const stats = await getMarketplaceStats(item.album.discogsId);

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
    console.error(`Error syncing price for item ${req.params?.itemId}:`, error);
    res.status(500).json({ message: 'Internal server error while syncing price' });
  }
}

export { fetchPriceForItem, getValueForItem };
