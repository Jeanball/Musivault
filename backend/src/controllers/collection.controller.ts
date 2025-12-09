import { Request, Response } from 'express';
import type { Express } from 'express';
import Album, { IAlbum } from '../models/Album';
import CollectionItem from '../models/CollectionItem';
import { csvImportService } from '../services/csv-import.service';

// ===== Types =====

interface AddToCollectionBody {
  discogsId: number;
  title: string;
  artist: string;
  year: string;
  thumb: string;
  cover_image: string;
  format: string;
}

// ===== CSV Import =====

export async function downloadTemplate(req: Request, res: Response) {
  const csvContent = [
    'Artist,Album,Year (Optional),Format (Vinyl or CD)',
    'Daft Punk,Discovery,2001,Vinyl',
    'Radiohead,OK Computer, ,CD'
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

    res.status(200).json({
      message: `Import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.failed} failed`,
      ...result
    });
  } catch (error) {
    console.error('Error during CSV import:', error);
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

    const { sort, limit } = req.query;
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

    const collection = await query.exec();

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

    const { discogsId, title, artist, year, thumb, cover_image, format } = req.body as AddToCollectionBody;

    // Find or create album
    let album = await Album.findOne({ discogsId });
    if (!album) {
      album = new Album({ discogsId, title, artist, year, thumb, cover_image });
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