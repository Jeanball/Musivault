import { Request, Response } from 'express';
import type { Express } from 'express';
import Album, { IAlbum } from '../models/Album';
import CollectionItem from '../models/CollectionItem';
import axios from 'axios';
import { Readable } from 'stream';
import csv from 'csv-parser';


interface AddToCollectionBody {
    discogsId: number;
    title: string;
    artist: string;
    year: string;
    thumb: string,
    cover_image: string;
    format: string;
}

// ===== IMPORT CSV =====

interface CsvRowRaw {
  [key: string]: string | undefined;
}

interface CsvRow {
  artiste: string;
  album: string;
  annee?: string;
  type: 'Vinyl' | 'CD';
}

interface FoundAlbumInfo {
  discogsId: number;
  title: string;
  artist: string;
  year: string;
  thumb: string;
  cover_image: string;
}

function normalizeHeader(header: string): string {
  // Lowercase, remove anything in parentheses, trim spaces
  return header.toLowerCase().replace(/\(.*\)/g, '').trim();
}

function normalizeType(input?: string): 'Vinyl' | 'CD' | undefined {
  if (!input) return undefined;
  const v = input.toLowerCase().trim();
  if (['vinyl', 'vinyle', 'lp', '33', '33t', '45', '45t', 'records'].some(k => v.includes(k))) return 'Vinyl';
  if (['cd', 'compact disc', 'compact-disc'].some(k => v.includes(k))) return 'CD';
  return undefined;
}

async function searchDiscogsByArtistAlbum(artist: string, title: string, year?: string): Promise<FoundAlbumInfo | null> {
  const key = process.env.DISCOGS_KEY;
  const secret = process.env.DISCOGS_SECRET;
  
  console.log(`[CSV Import] Searching Discogs for: "${artist}" - "${title}" (year: ${year || 'N/A'})`);
  
  if (!key || !secret) {
    console.log('[CSV Import] ERROR: DISCOGS_KEY or DISCOGS_SECRET not set');
    return null;
  }

  const base = 'https://api.discogs.com/database/search';
  const headers = { 'User-Agent': 'Musivault/1.0' };

  // Utiliser 'q' pour une recherche plus flexible
  const authParams: Record<string, string> = { 
    key, 
    secret, 
    q: `${artist} ${title}`
  };

  // Try masters first
  try {
    console.log('[CSV Import] Trying masters...');
    const masters = await axios.get<{ results: any[] }>(base, {
      headers,
      params: { ...authParams, type: 'master' }
    });
    let pick = masters.data.results || [];
    console.log(`[CSV Import] Found ${pick.length} masters`);
    
    if (year && year.trim()) {
      const y = year.trim();
      const filtered = pick.filter(r => (r.year?.toString() || '') === y);
      if (filtered.length) pick = filtered;
    }
    if (pick.length) {
      const r = pick[0];
      console.log(`[CSV Import] Selected master: ${r.title} (ID: ${r.id})`);
      return {
        discogsId: r.id,
        title: r.title,
        artist: artist,
        year: (r.year?.toString() || ''),
        thumb: r.thumb || '',
        cover_image: r.cover_image || r.thumb || ''
      };
    }
  } catch (err: any) {
    console.log('[CSV Import] Master search error:', err.message);
  }

  // Fallback to releases
  try {
    console.log('[CSV Import] Trying releases...');
    const releases = await axios.get<{ results: any[] }>(base, {
      headers,
      params: { ...authParams, type: 'release' }
    });
    let pick = releases.data.results || [];
    console.log(`[CSV Import] Found ${pick.length} releases`);
    
    if (year && year.trim()) {
      const y = year.trim();
      const filtered = pick.filter(r => (r.year?.toString() || '') === y);
      if (filtered.length) pick = filtered;
    }
    if (pick.length) {
      const r = pick[0];
      console.log(`[CSV Import] Selected release: ${r.title} (ID: ${r.id})`);
      return {
        discogsId: r.id,
        title: r.title,
        artist: artist,
        year: (r.year?.toString() || ''),
        thumb: r.thumb || '',
        cover_image: r.cover_image || r.thumb || ''
      };
    }
  } catch (err: any) {
    console.log('[CSV Import] Release search error:', err.message);
  }

  console.log('[CSV Import] No results found');
  return null;
}

export async function downloadTemplate(req: Request, res: Response) {
  const csvContent = [
    'Artiste,Album,Annee (Optionnel),Type (Vinyl ou CD)',
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
      res.status(401).json({ message: 'Utilisateur non authentifié.' });
      return;
    }
    // Multer should have attached file as req.file
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ message: 'Fichier CSV manquant. Form field name must be "file".' });
      return;
    }

    const rawRows: CsvRowRaw[] = [];

    await new Promise<void>((resolve, reject) => {
      // Create a stream from the uploaded buffer
      const stream = Readable.from(file.buffer.toString());
      stream
        .pipe(csv())
        .on('data', (row: any) => rawRows.push(row))
        .on('end', () => resolve())
        .on('error', (err: any) => reject(err));
    });

    const rows: CsvRow[] = rawRows.map((r) => {
      // Normalize headers
      const mapped: Record<string, string | undefined> = {};
      Object.keys(r).forEach((k) => {
        mapped[normalizeHeader(k)] = (r as any)[k];
      });
      const typeNorm = normalizeType(mapped['type']);
      return {
        artiste: (mapped['artiste'] || '').toString().trim(),
        album: (mapped['album'] || '').toString().trim(),
        annee: (mapped['annee'] || '').toString().trim() || undefined,
        type: (typeNorm || 'Vinyl')
      };
    });

    const userId = req.user._id;
    let imported = 0;
    const failures: Array<{ index: number; artiste: string; album: string; reason: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.artiste || !row.album) {
        failures.push({ index: i + 1, artiste: row.artiste || '', album: row.album || '', reason: 'Champs Artiste/Album manquants' });
        continue;
      }

      try {
        const found = await searchDiscogsByArtistAlbum(row.artiste, row.album, row.annee);
        if (!found) {
          failures.push({ index: i + 1, artiste: row.artiste, album: row.album, reason: 'Aucun résultat Discogs' });
          continue;
        }

        console.log(`[CSV Import] Saving album to DB: ${found.title} (discogsId: ${found.discogsId})`);
        let album = await Album.findOne({ discogsId: found.discogsId });
        if (!album) {
          album = new Album({
            discogsId: found.discogsId,
            title: found.title,
            artist: found.artist,
            year: found.year,
            thumb: found.thumb,
            cover_image: found.cover_image,
          });
          await album.save();
          console.log(`[CSV Import] Album created in DB`);
        } else {
          console.log(`[CSV Import] Album already exists in DB`);
        }

        console.log(`[CSV Import] Checking if already in collection (format: ${row.type})`);
        const exists = await CollectionItem.findOne({ user: userId, album: album._id, 'format.name': row.type });
        if (exists) {
          console.log(`[CSV Import] Already in collection, skipping`);
          failures.push({ index: i + 1, artiste: row.artiste, album: row.album, reason: 'Déjà présent dans ce format' });
          continue;
        }

        console.log(`[CSV Import] Adding to collection...`);
        const formatObj = {
          name: row.type,
          descriptions: [],
          text: row.type
        };
        const newItem = new CollectionItem({ user: userId, album: album._id, format: formatObj });
        await newItem.save();
        console.log(`[CSV Import] SUCCESS: Added to collection`);
        imported++;
      } catch (err: any) {
        console.log(`[CSV Import] ERROR during processing:`, err.message);
        failures.push({ index: i + 1, artiste: row.artiste, album: row.album, reason: 'Erreur lors du traitement' });
      }
    }

    res.status(200).json({ imported, failed: failures.length, failures });
  } catch (error) {
    console.error('Erreur lors de l\'import CSV :', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
}

export async function getMyCollection(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Utilisateur non authentifié." });
            return;
        }
        const userId = req.user._id;
        const { sort, limit } = req.query;

        let query = CollectionItem.find({ user: userId })
            .populate<{album: IAlbum}>('album');

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
        console.error("Erreur lors de la récupération de la collection :", error);
        res.status(500).json({ message: "Erreur interne du serveur" });
    }
}

export async function addToCollection(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Utilisateur non authentifié." });
            return;
        }

        const { discogsId, title, artist, year, thumb, cover_image, format } = req.body as AddToCollectionBody;
        
        const userId = req.user._id;


        let album = await Album.findOne({ discogsId: discogsId });
        
        if (!album) {
            album = new Album({ discogsId, title, artist, year, thumb, cover_image });
            await album.save();
        }

        const existingItem = await CollectionItem.findOne({
            user: userId,
            album: album._id,
            format: format
        });

        if (existingItem) {
            res.status(409).json({ message: "Vous avez déjà cet album dans ce format." });
            return;
        }
        

        const newCollectionItem = new CollectionItem({
            user: userId,
            album: album._id,
            format: format,
        });

        await newCollectionItem.save();

        res.status(201).json({ message: "Album ajouté à votre collection avec succès !", item: newCollectionItem });

    } catch (error) {
        console.error("Erreur lors de l'ajout à la collection :", error);
        res.status(500).json({ message: "Erreur interne du serveur" });
    }
}

export async function deleteFromCollection(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Utilisateur non authentifié." });
            return;
        }
        const userId = req.user._id;
        const { itemId } = req.params;

        const itemToDelete = await CollectionItem.findOneAndDelete({ _id: itemId, user: userId });

        if (!itemToDelete) {
            res.status(404).json({ message: "Élément non trouvé dans votre collection." });
            return;
        }

        res.status(200).json({ message: "Album supprimé de votre collection avec succès." });

    } catch (error) {
        console.error("Erreur lors de la suppression de l'élément de la collection :", error);
        res.status(500).json({ message: "Erreur interne du serveur" });
    }
}