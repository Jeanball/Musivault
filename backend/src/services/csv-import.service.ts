import { Readable } from 'stream';
import csv from 'csv-parser';
import Album from '../models/Album';
import CollectionItem from '../models/CollectionItem';
import { discogsService, FoundAlbumInfo } from './discogs.service';

// ===== Types =====

interface CsvRowRaw {
    [key: string]: string | undefined;
}

export interface CsvRow {
    artist: string;
    album: string;
    year?: string;
    format: 'Vinyl' | 'CD';
}

export interface ImportResult {
    imported: number;
    failed: number;
    failures: Array<{ index: number; artist: string; album: string; reason: string }>;
}

// ===== Helpers =====

function normalizeHeader(header: string): string {
    return header.toLowerCase().replace(/\(.*\)/g, '').trim();
}

function normalizeType(input?: string): 'Vinyl' | 'CD' | undefined {
    if (!input) return undefined;
    const v = input.toLowerCase().trim();
    if (['vinyl', 'vinyle', 'lp', '33', '33t', '45', '45t', 'records'].some(k => v.includes(k))) return 'Vinyl';
    if (['cd', 'compact disc', 'compact-disc'].some(k => v.includes(k))) return 'CD';
    return undefined;
}

// ===== Service Functions =====

/**
 * Parse CSV buffer into structured rows
 */
export async function parseCsvBuffer(buffer: Buffer): Promise<CsvRow[]> {
    const rawRows: CsvRowRaw[] = [];

    await new Promise<void>((resolve, reject) => {
        const stream = Readable.from(buffer.toString());
        stream
            .pipe(csv())
            .on('data', (row: CsvRowRaw) => rawRows.push(row))
            .on('end', () => resolve())
            .on('error', (err: Error) => reject(err));
    });

    return rawRows.map((r) => {
        const mapped: Record<string, string | undefined> = {};
        Object.keys(r).forEach((k) => {
            mapped[normalizeHeader(k)] = r[k];
        });

        return {
            artist: (mapped['artist'] || '').toString().trim(),
            album: (mapped['album'] || '').toString().trim(),
            year: (mapped['year'] || '').toString().trim() || undefined,
            format: normalizeType(mapped['format']) || 'Vinyl'
        };
    });
}

/**
 * Process a single import row: search Discogs, create/find album, add to collection
 */
export async function processImportRow(
    row: CsvRow,
    userId: any
): Promise<{ success: boolean; reason?: string }> {
    // Validate row
    if (!row.artist || !row.album) {
        return { success: false, reason: 'Missing Artist/Album' };
    }

    // Search Discogs
    const found = await discogsService.searchByArtistAlbum(row.artist, row.album, row.year);
    if (!found) {
        return { success: false, reason: 'No Discogs result' };
    }

    // Find or create album
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
        console.log(`[Import] Album created: ${album.title}`);
    }

    // Check if already in collection
    const exists = await CollectionItem.findOne({
        user: userId,
        album: album._id,
        'format.name': row.format
    });
    if (exists) {
        return { success: false, reason: 'Already in collection (same format)' };
    }

    // Add to collection
    const newItem = new CollectionItem({
        user: userId,
        album: album._id,
        format: { name: row.format, descriptions: [], text: row.format }
    });
    await newItem.save();
    console.log(`[Import] Added to collection: ${album.title}`);

    return { success: true };
}

/**
 * Import albums from CSV buffer for a user
 */
export async function importFromCsv(buffer: Buffer, userId: any): Promise<ImportResult> {
    const rows = await parseCsvBuffer(buffer);

    let imported = 0;
    const failures: ImportResult['failures'] = [];

    for (let i = 0; i < rows.length; i++) {
        try {
            const result = await processImportRow(rows[i], userId);
            if (result.success) {
                imported++;
            } else {
                failures.push({
                    index: i + 1,
                    artist: rows[i].artist,
                    album: rows[i].album,
                    reason: result.reason!
                });
            }
        } catch (err: any) {
            console.log(`[Import] Error processing row ${i + 1}:`, err.message);
            failures.push({
                index: i + 1,
                artist: rows[i].artist,
                album: rows[i].album,
                reason: 'Processing error'
            });
        }
    }

    return { imported, failed: failures.length, failures };
}

export const csvImportService = {
    parseCsvBuffer,
    processImportRow,
    importFromCsv
};
