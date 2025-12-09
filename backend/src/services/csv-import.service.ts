import { Readable } from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import Album from '../models/Album';
import CollectionItem from '../models/CollectionItem';
import ImportLog, { IImportLogEntry } from '../models/ImportLog';
import User from '../models/User';
import { discogsService, FoundAlbumInfo } from './discogs.service';

// Ensure logs directory exists
// Use /app/logs/imports in Docker, or fallback to relative path for local dev
const DOCKER_LOGS_ROOT = '/logs';
const LOGS_DIR = fs.existsSync(DOCKER_LOGS_ROOT)
    ? path.join(DOCKER_LOGS_ROOT, 'imports')
    : path.join(__dirname, '../../logs/imports');

// Create directory if it doesn't exist (with error handling)
try {
    if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
} catch (err) {
    console.warn(`[Import] Could not create logs directory: ${LOGS_DIR}`, err);
}

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
    skipped: number;
    logId: string;
    failures: Array<{ index: number; artist: string; album: string; reason: string }>;
}

interface ProcessRowResult {
    success: boolean;
    skipped?: boolean;
    reason?: string;
    matchedData?: FoundAlbumInfo;
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
 * Returns detailed result including matched data for logging
 */
export async function processImportRow(
    row: CsvRow,
    userId: any
): Promise<ProcessRowResult> {
    // Validate row
    if (!row.artist || !row.album) {
        return { success: false, reason: 'Missing Artist/Album' };
    }

    // Search Discogs
    const found = await discogsService.searchByArtistAlbum(row.artist, row.album, row.year);
    if (!found) {
        return { success: false, reason: 'No Discogs match found' };
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
        return {
            success: false,
            skipped: true,
            reason: 'Already in collection',
            matchedData: found
        };
    }

    // Add to collection
    const newItem = new CollectionItem({
        user: userId,
        album: album._id,
        format: { name: row.format, descriptions: [], text: row.format }
    });
    await newItem.save();
    console.log(`[Import] Added to collection: ${album.title}`);

    return { success: true, matchedData: found };
}

/**
 * Import albums from CSV buffer for a user
 * Creates detailed import log in database
 */
export async function importFromCsv(
    buffer: Buffer,
    userId: any,
    fileName?: string
): Promise<{ logId: string; totalRows: number }> {
    const rows = await parseCsvBuffer(buffer);

    // Create initial import log
    const importLog = new ImportLog({
        user: userId,
        fileName: fileName || 'import.csv',
        totalRows: rows.length,
        successCount: 0,
        failCount: 0,
        skipCount: 0,
        status: 'processing',
        entries: []
    });
    await importLog.save();
    const logId = String(importLog._id);

    console.log(`[Import] Started import ${logId} with ${rows.length} rows`);

    // Run processing in background (no await)
    processImportBackground(rows, importLog, userId).catch(err => {
        console.error(`[Import] Background process failed for ${logId}:`, err);
        importLog.status = 'error';
        importLog.save();
    });

    return {
        logId,
        totalRows: rows.length
    };
}

/**
 * Background processor for import rows
 */
async function processImportBackground(
    rows: CsvRow[],
    importLog: any,
    userId: any
) {
    let imported = 0;
    let skipped = 0;
    let failures = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const logEntry: IImportLogEntry = {
            rowIndex: i + 1,
            inputArtist: row.artist,
            inputAlbum: row.album,
            inputYear: row.year,
            inputFormat: row.format,
            status: 'failed'
        };

        try {
            const result = await processImportRow(row, userId);

            if (result.matchedData) {
                logEntry.matchedArtist = result.matchedData.artist;
                logEntry.matchedAlbum = result.matchedData.title;
                logEntry.matchedYear = result.matchedData.year;
                logEntry.discogsId = result.matchedData.discogsId;
            }

            if (result.success) {
                imported++;
                logEntry.status = 'success';
            } else if (result.skipped) {
                skipped++;
                logEntry.status = 'skipped';
                logEntry.reason = result.reason;
            } else {
                failures++;
                logEntry.status = 'failed';
                logEntry.reason = result.reason;
            }
        } catch (err: any) {
            console.log(`[Import] Error processing row ${i + 1}:`, err.message);
            logEntry.status = 'failed';
            logEntry.reason = `Processing error: ${err.message}`;
            failures++;
        }

        // Update log document incrementally
        // We push the new entry and update counts
        // To be safe and avoid race conditions or massive writes, we could batch,
        // but for 1 update every 1.1s, direct update is fine.
        importLog.entries.push(logEntry);
        importLog.successCount = imported;
        importLog.skipCount = skipped;
        importLog.failCount = failures;

        // Save progress
        await importLog.save();
    }

    // Mark as completed
    importLog.status = 'completed';
    await importLog.save();
    console.log(`[Import] Finished import ${importLog._id}`);

    // Save final JSON file log
    await saveJsonLogFile(importLog);
}

async function saveJsonLogFile(importLog: any) {
    try {
        // Get user info for filename
        const userId = importLog.user;
        const userDoc = await User.findById(userId);
        const safeUsername = userDoc ? userDoc.username.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown';

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFileName = `import_${timestamp}_${safeUsername}_${String(importLog._id)}.json`;
        const logFilePath = path.join(LOGS_DIR, logFileName);

        const fileLogData = {
            _id: String(importLog._id),
            importedAt: new Date().toISOString(),
            fileName: importLog.fileName,
            summary: {
                totalRows: importLog.totalRows,
                successCount: importLog.successCount,
                failCount: importLog.failCount,
                skipCount: importLog.skipCount
            },
            entries: importLog.entries
        };

        fs.writeFileSync(logFilePath, JSON.stringify(fileLogData, null, 2));
        console.log(`[Import] Log file saved: ${logFilePath}`);
    } catch (err) {
        console.error('[Import] Failed to save JSON log file:', err);
    }
}

/**
 * Get import logs for a user
 */
export async function getImportLogs(userId: any, limit: number = 10) {
    return ImportLog.find({ user: userId })
        .select('-entries') // Don't include full entries for list view
        .sort({ importedAt: -1 })
        .limit(limit);
}

/**
 * Get a specific import log with full details
 */
export async function getImportLogById(logId: string, userId: any) {
    return ImportLog.findOne({ _id: logId, user: userId });
}

export const csvImportService = {
    parseCsvBuffer,
    processImportRow,
    importFromCsv,
    getImportLogs,
    getImportLogById
};
