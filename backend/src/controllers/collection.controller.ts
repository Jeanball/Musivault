import { Request, Response } from 'express';
import type { Express } from 'express';
import Album, { IAlbum } from '../models/Album';
import CollectionItem, { ICollectionItem } from '../models/CollectionItem';
import { csvImportService } from '../services/import.service';
import { getMarketplaceStats } from '../services/discogs.service';

// ===== Types =====

interface TrackInput {
  position: string;
  title: string;
  duration: string;
  artist?: string;
}

interface LabelInput {
  name: string;
  catno: string;
}

interface AddToCollectionBody {
  discogsId: number;
  title: string;
  artist: string;
  year: string;
  thumb: string;
  cover_image: string;
  format: string;
  styles?: string[];
  tracklist?: TrackInput[];
  labels?: LabelInput[];
  mediaCondition?: string;
  sleeveCondition?: string;
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
    const newItem = new CollectionItem({
      user: req.user._id,
      album: album._id,
      format: format,
      mediaCondition: mediaCondition || null,
      sleeveCondition: sleeveCondition || null,
    });
    await newItem.save();

    // Fire-and-forget: fetch price in the background
    if (discogsId) {
      fetchPriceForItem(String(newItem._id), discogsId).catch(() => {});
    }

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

    // Build update object dynamically
    const updateFields: Record<string, unknown> = {};

    if (format?.name) {
      updateFields["format.name"] = format.name;
      updateFields["format.text"] = format.name;
    }

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

// ===== Album Rematch =====

export async function rematchAlbum(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { itemId } = req.params;
    const { newDiscogsId } = req.body;

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

    // Fetch release details from Discogs
    const discogsSecret = process.env.DISCOGS_SECRET;
    if (!discogsSecret) {
      res.status(500).json({ message: 'Server configuration error' });
      return;
    }

    const axios = (await import('axios')).default;
    const discogsResponse = await axios.get(`https://api.discogs.com/releases/${newDiscogsId}`, {
      headers: {
        'Authorization': `Discogs token=${discogsSecret}`,
        'User-Agent': 'Musivault/1.0'
      }
    });

    const releaseData = discogsResponse.data;

    // Clean the title (remove artist prefix)
    let cleanedTitle = releaseData.title;
    const separator = ' - ';
    const separatorIndex = cleanedTitle.indexOf(separator);
    if (separatorIndex !== -1) {
      cleanedTitle = cleanedTitle.substring(separatorIndex + separator.length).trim();
    }

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

    await album.save();

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

export async function syncCollectionValues(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Set up Server-Sent Events for progress streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Find ALL items for this user, populate album for discogsId
    const allItems = await CollectionItem.find({ user: req.user._id })
      .populate<{ album: IAlbum }>('album');

    let synced = 0;
    let skipped = 0;
    const total = allItems.length;

    console.log(`[PriceSync] Starting sync for ${total} items`);

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const idx = i + 1;

      if (!item.album || !item.album.discogsId) {
        skipped++;
        console.log(`[PriceSync] ${idx}/${total} SKIP - ${item.album?.artist || 'Unknown'} - ${item.album?.title || 'Unknown'} (no discogsId)`);
        continue;
      }

      const artist = item.album.artist;
      const title = item.album.title;

      // Send progress event to frontend
      res.write(`data: ${JSON.stringify({
        type: 'progress',
        current: idx,
        total,
        artist,
        title,
      })}\n\n`);

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
        synced++;
        console.log(`[PriceSync] ${idx}/${total} SUCCESS - ${artist} - ${title} | VG+: ${stats.veryGoodPlus} ${stats.currency} | NM: ${stats.nearMint} | M: ${stats.mint}`);
      } else {
        skipped++;
        console.log(`[PriceSync] ${idx}/${total} FAILED - ${artist} - ${title} (no data or PAT not configured)`);
      }
    }

    // Calculate total collection value (uses condition-matched price per item)
    let totalValue = 0;
    let currency = 'USD';
    for (const item of allItems) {
      const val = getValueForItem(item);
      if (val > 0) {
        totalValue += val;
        currency = item.priceCache?.currency || 'USD';
      }
    }

    console.log(`[PriceSync] Complete: ${synced}/${total} synced, ${skipped} skipped. Total value: ${totalValue.toFixed(2)} ${currency}`);

    // Send final event with summary
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      synced,
      skipped,
      total,
      totalValue: Math.round(totalValue * 100) / 100,
      currency,
      message: `Synced ${synced}/${total} items.`
    })}\n\n`);

    res.end();
  } catch (error) {
    console.error('Error syncing collection values:', error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Internal server error' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ message: 'Internal server error' });
    }
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