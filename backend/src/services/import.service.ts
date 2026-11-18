import { Readable } from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import Album, { ITrack } from '../models/Album';
import CollectionItem from '../models/CollectionItem';
import ImportLog, { IImportLogEntry } from '../models/ImportLog';
import User from '../models/User';
import { discogsService } from './discogs.service';
import { loadCustomFieldsWithUuids } from './customFields.service';
import { stripArtistSuffixes } from '../utils/discogs.utils';
import { parseCustomFieldHeader } from '../utils/customFields.utils';
import { buildPriceCache } from '../utils/price.utils';
import { saveCoverFromBase64, downloadCoverToLocal } from '../utils/cover.utils';
import { FoundAlbumInfo } from '../types/discogs.types';
import { logger } from '../config/logger.config';

// Ensure logs directory exists
// Use /app/logs/imports in Docker, or fallback to relative path for local dev
// Use relative path which resolves to /app/logs in Docker (mounted volume)
// and project_root/logs in development
const LOGS_DIR = path.join(__dirname, '../../logs/imports');

// Create directory if it doesn't exist (with error handling)
try {
    if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
} catch (err) {
    logger.warn({ err }, `[Import] Could not create logs directory: ${LOGS_DIR}`);
}

// ===== Types =====

interface CsvRowRaw {
    [key: string]: string | undefined;
}

/** One non-base CSV column, optionally carrying the field's hidden uuid. */
export interface CustomFieldColumn {
    /** Lower-cased visible name, used for files exported before uuids. */
    name: string;
    /** Stable field identity written by newer exports. */
    uuid?: string;
    value: string;
}

/** How an imported column finds a definition: uuid first, name as fallback. */
export interface CustomFieldLookup {
    byUuid: Map<string, string>;
    byName: Map<string, string>;
}

export interface CsvRow {
    artist: string;
    album: string;
    year?: string;
    format?: 'Vinyl' | 'CD';
    /** Raw Format column, so manual albums keep names like Cassette. */
    formatName?: string;
    releaseId?: string;
    catalogNumber?: string;
    label?: string;
    /** Finer Discogs styles, shown in the app as "Generi". */
    genres?: string[];
    /** Broad Discogs genres (Jazz, Rock, ...), used by the genre filter. */
    discogsGenres?: string[];
    /** Hand-entered value in USD. */
    value?: number;
    tracklist?: ITrack[];
    /** The row was added by hand, so it has no Discogs release to look up. */
    manual?: boolean;
    mediaCondition?: string;
    sleeveCondition?: string;
    addedAt?: Date;
    /** A locally uploaded cover, exported as a base64/data-URI cell. */
    coverBase64?: string;
    /**
     * Columns that are not part of the base format. Newer exports carry the
     * field's uuid in the header; older ones only carry the name (already
     * lower-cased). Columns with no matching field are ignored.
     */
    customFieldColumns?: CustomFieldColumn[];
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
    matchMethod?: 'releaseId' | 'catalogNumber' | 'search';
}

// ===== Helpers =====

function normalizeHeader(header: string): string {
    // Exports start with a UTF-8 BOM so Excel reads accents; drop it before
    // matching, otherwise "Artist" becomes "\uFEFFartist".
    return header.replace(/^\uFEFF/, '').toLowerCase().replace(/\(.*\)/g, '').trim();
}

function normalizeType(input?: string): 'Vinyl' | 'CD' | undefined {
    if (!input) return undefined;
    const v = input.toLowerCase().trim();
    if (['vinyl', 'vinyle', 'lp', '33', '33t', '45', '45t', 'records'].some(k => v.includes(k))) return 'Vinyl';
    if (['cd', 'compact disc', 'compact-disc'].some(k => v.includes(k))) return 'CD';
    return undefined;
}

/** Lower-cased column headers the importer understands itself. */
const BASE_COLUMN_KEYS = new Set([
    'artist', 'album', 'format', 'year',
    'release id', 'releaseid', 'release_id', 'discogs id', 'discogs_id', 'discogsid',
    'catalog number', 'catalognumber', 'catalog_number', 'catno', 'cat_no',
    'label', 'genres', 'genre', 'discogs genres', 'value', 'tracklist', 'manual',
    'media condition', 'mediacondition', 'media_condition', 'media',
    'sleeve condition', 'sleevecondition', 'sleeve_condition', 'sleeve',
    'added at', 'addedat', 'added_at',
    'cover base64', 'coverbase64', 'cover_base64', 'cover image', 'coverimage', 'cover_image',
    'image base64', 'imagebase64', 'image_base64'
]);

function parseGenres(raw?: string): string[] {
    if (!raw) return [];
    return Array.from(new Set(raw.split(/[,;]/).map(part => part.trim()).filter(Boolean)));
}

/** Exported tracklists are a JSON array; anything malformed is ignored. */
function parseTracklist(raw?: string): ITrack[] {
    if (!raw) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];

    return parsed
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        .map(entry => ({
            position: String(entry.position ?? '').trim(),
            title: String(entry.title ?? '').trim(),
            duration: String(entry.duration ?? '').trim(),
            artist: String(entry.artist ?? '').trim()
        }))
        .filter(track => track.position || track.title || track.duration || track.artist);
}

function parseValue(raw?: string): number | undefined {
    const text = raw?.trim();
    if (!text) return undefined;
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount < 0) return undefined;
    return Math.round(amount * 100) / 100;
}

function parseAddedAt(raw?: string): Date | undefined {
    const text = raw?.trim();
    if (!text) return undefined;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function isTrue(raw?: string): boolean {
    return ['true', '1', 'yes', 'y'].includes(raw?.trim().toLowerCase() || '');
}

export function normalizeCustomFieldName(name: string): string {
    return name.trim().toLowerCase();
}

/**
 * Map imported custom-field columns to definition ids. The uuid wins, because
 * the field may have been renamed since the file was written; the name keeps
 * files exported before uuids (and files from another instance) working.
 */
function resolveCustomFieldValues(
    columns: CustomFieldColumn[] | undefined,
    definitions: CustomFieldLookup | undefined
): Record<string, string> {
    if (!columns?.length || !definitions) return {};

    const values: Record<string, string> = {};
    for (const column of columns) {
        const fieldId =
            (column.uuid ? definitions.byUuid.get(column.uuid) : undefined) ??
            definitions.byName.get(normalizeCustomFieldName(column.name));
        if (!fieldId) continue;
        const trimmed = column.value?.trim();
        if (trimmed) values[fieldId] = trimmed;
    }
    return values;
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
            // csv-parser 3 allows arbitrarily long rows by default, which the
            // base64 cover cells need.
            .pipe(csv())
            .on('data', (row: CsvRowRaw) => rawRows.push(row))
            .on('end', () => resolve())
            .on('error', (err: Error) => reject(err));
    });

    return rawRows.map((r) => {
        const mapped: Record<string, string | undefined> = {};
        const customFieldColumns: CustomFieldColumn[] = [];

        Object.keys(r).forEach((k) => {
            const header = normalizeHeader(k);
            mapped[header] = r[k];
            if (!BASE_COLUMN_KEYS.has(header)) {
                const { name, uuid } = parseCustomFieldHeader(k);
                customFieldColumns.push({
                    name: normalizeCustomFieldName(name),
                    uuid,
                    value: r[k] ?? ''
                });
            }
        });

        // Extract release_id (various header formats)
        const releaseIdRaw = mapped['release_id'] || mapped['releaseid'] || mapped['release id'] || mapped['discogs_id'] || mapped['discogsid'] || mapped['discogs id'] || '';
        const releaseId = releaseIdRaw.toString().trim() || undefined;

        // Extract catalog number (various header formats)
        const catnoRaw = mapped['catno'] || mapped['catalog_number'] || mapped['catalognumber'] || mapped['catalog number'] || mapped['cat_no'] || '';
        const catalogNumber = catnoRaw.toString().trim() || undefined;

        // Extract condition fields
        const mediaConditionRaw = mapped['media_condition'] || mapped['mediacondition'] || mapped['media condition'] || mapped['media'] || '';
        const mediaCondition = mediaConditionRaw.toString().trim() || undefined;

        const sleeveConditionRaw = mapped['sleeve_condition'] || mapped['sleevecondition'] || mapped['sleeve condition'] || mapped['sleeve'] || '';
        const sleeveCondition = sleeveConditionRaw.toString().trim() || undefined;

        const formatRaw = (mapped['format'] || '').toString().trim() || undefined;
        const valueRaw = mapped['value']?.toString();
        const manualRaw = mapped['manual']?.toString();
        const addedAtRaw = mapped['added at'] || mapped['added_at'] || mapped['addedat'];
        const coverRaw =
            mapped['cover base64'] || mapped['coverbase64'] || mapped['cover_base64'] ||
            mapped['cover image'] || mapped['coverimage'] || mapped['cover_image'] ||
            mapped['image base64'] || mapped['imagebase64'] || mapped['image_base64'];

        return {
            artist: (mapped['artist'] || '').toString().trim(),
            album: (mapped['album'] || '').toString().trim(),
            year: (mapped['year'] || '').toString().trim() || undefined,
            format: normalizeType(formatRaw),
            formatName: formatRaw,
            releaseId,
            catalogNumber,
            label: (mapped['label'] || '').toString().trim() || undefined,
            genres: parseGenres((mapped['genres'] || mapped['genre'] || '').toString()),
            discogsGenres: parseGenres(mapped['discogs genres']?.toString()),
            value: parseValue(valueRaw),
            tracklist: parseTracklist(mapped['tracklist']?.toString()),
            manual: isTrue(manualRaw),
            mediaCondition,
            sleeveCondition,
            addedAt: parseAddedAt(addedAtRaw?.toString()),
            coverBase64: coverRaw?.toString().trim() || undefined,
            customFieldColumns: customFieldColumns.length ? customFieldColumns : undefined
        };
    });
}

/** What a caller other than the CSV import can set on the item it adds. */
export interface ImportRowOptions {
    /** The item's format name, as is (e.g. `Cassette`); wins over the row's `Vinyl`/`CD`. */
    formatName?: string;
    /** The item's date added; now when omitted. */
    addedAt?: Date;
    /** The Discogs collection entry the item stands for. */
    discogsInstanceId?: number;
    /** Wait and retry when Discogs throttles a call, instead of failing the row. For long background jobs. */
    retryOnRateLimit?: boolean;
    /**
     * How to find the importing user's custom fields. Columns whose uuid and
     * name both miss are ignored.
     */
    customFieldDefinitions?: CustomFieldLookup;
}

/** A hand-added album has no Discogs release, so rebuild it from the CSV row. */
async function createManualAlbumFromRow(
    row: CsvRow,
    userId: any,
    options: ImportRowOptions,
    customFields: Record<string, string>
): Promise<ProcessRowResult> {
    const format = row.formatName || row.format || 'Vinyl';

    let album = await Album.findOne({ isManual: true, title: row.album, artist: row.artist });
    if (!album) {
        album = new Album({
            isManual: true,
            title: row.album,
            artist: row.artist,
            year: row.year || '',
            thumb: '',
            cover_image: '',
            genres: row.discogsGenres || [],
            styles: row.genres || [],
            tracklist: row.tracklist || [],
            labels: row.label ? [{ name: row.label, catno: row.catalogNumber || '' }] : []
        });
        await album.save();
        logger.debug(`[Import] Manual album created: ${album.title}`);
    } else {
        // Fill in what an older manual album is missing; never overwrite data.
        let filled = false;
        if (!album.year && row.year) { album.year = row.year; filled = true; }
        if (!album.genres?.length && row.discogsGenres?.length) { album.genres = row.discogsGenres; filled = true; }
        if (!album.styles?.length && row.genres?.length) { album.styles = row.genres; filled = true; }
        if (!album.tracklist?.length && row.tracklist?.length) { album.tracklist = row.tracklist; filled = true; }
        if (!album.labels?.length && row.label) {
            album.labels = [{ name: row.label, catno: row.catalogNumber || '' }];
            filled = true;
        }
        if (filled) {
            await album.save();
            logger.debug(`[Import] Manual album filled in: ${album.title}`);
        }
    }

    // Restore the cover written by another export, but never replace one the
    // album already has. Failure to write the file must not fail the row.
    if (row.coverBase64 && !album.cover_image) {
        try {
            const coverPath = await saveCoverFromBase64(row.coverBase64);
            if (coverPath) {
                album.cover_image = coverPath;
                album.thumb = coverPath;
                await album.save();
                logger.debug(`[Import] Manual album cover restored: ${album.title}`);
            }
        } catch (err) {
            logger.warn({ err, album: album.title }, '[Import] Could not restore the album cover');
        }
    }

    const exists = await CollectionItem.findOne({
        user: userId,
        album: album._id,
        'format.name': format
    });
    if (exists) {
        return { success: false, skipped: true, reason: 'Already in collection' };
    }

    const newItem = new CollectionItem({
        user: userId,
        album: album._id,
        format: { name: format, descriptions: [], text: format },
        mediaCondition: row.mediaCondition || null,
        sleeveCondition: row.sleeveCondition || null,
        manualValue: row.value ?? null,
        customFields,
        addedAt: options.addedAt ?? row.addedAt
    });
    await newItem.save();
    logger.debug(`[Import] Added manual album to collection: ${album.title} (${format})`);

    return { success: true };
}

function isManualRow(row: CsvRow): boolean {
    if (row.manual) return true;
    // Exports from older versions have no Manual column. Rows with hand-entered
    // data and no Discogs id can only have come from a manual album.
    return !row.releaseId && Boolean(
        row.label || row.genres?.length || row.tracklist?.length || row.value !== undefined
    );
}

/**
 * Find the album for a Discogs release in the shared albums, or create it from the release data.
 * An album that exists but is bare (older CSV imports) gets its missing styles, tracklist and labels
 * filled in; data already there is never overwritten.
 */
export async function upsertAlbumFromDiscogs(found: FoundAlbumInfo) {
    let album = await Album.findOne({ discogsId: found.discogsId });
    if (!album) {
        // Discogs serves remote images: keep a local copy, like an album added from search.
        const localCover = await downloadCoverToLocal(found.cover_image || found.thumb, 'Discogs cover');
        album = new Album({
            discogsId: found.discogsId,
            title: found.title,
            artist: stripArtistSuffixes(found.artist),
            year: found.year,
            thumb: localCover || found.thumb,
            cover_image: localCover || found.cover_image,
            genres: found.genres || [],
            styles: found.styles || [],
            tracklist: found.tracklist || [],
            labels: found.labels || [],
        });
        await album.save();
        logger.debug(`[Import] Album created: ${album.title}`);
    } else {
        let filled = false;
        if (!album.genres?.length && found.genres?.length) { album.genres = found.genres; filled = true; }
        if (!album.styles?.length && found.styles?.length) { album.styles = found.styles; filled = true; }
        if (!album.tracklist?.length && found.tracklist?.length) { album.tracklist = found.tracklist; filled = true; }
        if (!album.labels?.length && found.labels?.length) { album.labels = found.labels; filled = true; }

        // Covers saved before the local copy existed are still remote URLs.
        if (album.cover_image && /^https?:\/\//i.test(album.cover_image)) {
            const localized = await downloadCoverToLocal(album.cover_image, 'Discogs cover');
            if (localized !== album.cover_image) {
                album.cover_image = localized;
                album.thumb = localized;
                filled = true;
            }
        }

        if (filled) {
            await album.save();
            logger.debug(`[Import] Album filled in: ${album.title}`);
        }
    }
    return album;
}

/**
 * Process a single import row: search Discogs, create/find album, add to collection
 * Returns detailed result including matched data for logging
 * 
 * Search priority:
 * 1. If releaseId provided -> Direct lookup (most precise)
 * 2. If catalogNumber provided -> Search by catno
 * 3. Fallback -> Search by artist/album
 *
 * Skips (without error) a row whose album is already in the user's collection in the same format.
 * Makes one Discogs call for the release and one for its price, each paced by `RATE_LIMIT_MS`.
 * `options` is for callers that know more than a CSV row does, like the Discogs sync.
 */
export async function processImportRow(
    row: CsvRow,
    userId: any,
    options: ImportRowOptions = {}
): Promise<ProcessRowResult> {
    // Validate row - need at least artist/album OR releaseId
    if (!row.releaseId && (!row.artist || !row.album)) {
        return { success: false, reason: 'Missing Artist/Album or Release ID' };
    }

    const customFields = resolveCustomFieldValues(row.customFieldColumns, options.customFieldDefinitions);

    // Manual rows have no Discogs release to fetch: rebuild the album from the row.
    if (isManualRow(row)) {
        return createManualAlbumFromRow(row, userId, options, customFields);
    }

    let found: FoundAlbumInfo | null = null;
    let matchMethod: 'releaseId' | 'catalogNumber' | 'search' = 'search';

    // Priority 1: Direct release ID lookup
    if (row.releaseId) {
        logger.debug(`[Import] Trying direct release ID lookup: ${row.releaseId}`);
        found = await discogsService.fetchByReleaseId(row.releaseId, { retryOnRateLimit: options.retryOnRateLimit });
        if (found) {
            matchMethod = 'releaseId';
            logger.debug(`[Import] Matched via release ID: ${found.artist} - ${found.title}`);
        }
    }

    // Priority 2: Catalog number search
    if (!found && row.catalogNumber) {
        logger.debug(`[Import] Trying catalog number search: ${row.catalogNumber}`);
        found = await discogsService.searchByCatalogNumber(row.catalogNumber, row.artist, row.album);
        if (found) {
            matchMethod = 'catalogNumber';
            logger.debug(`[Import] Matched via catalog number: ${found.artist} - ${found.title}`);
        }
    }

    // Priority 3: Standard artist/album search
    if (!found && row.artist && row.album) {
        logger.debug(`[Import] Trying artist/album search: ${row.artist} - ${row.album}`);
        found = await discogsService.searchByArtistAlbum(row.artist, row.album, row.year);
        if (found) {
            matchMethod = 'search';
            logger.debug(`[Import] Matched via search: ${found.artist} - ${found.title}`);
        }
    }

    if (!found) {
        return { success: false, reason: 'No Discogs match found' };
    }

    // Catalog-number and search matches only carry search data: fetch the release once so
    // every imported album gets the same data as one added from search
    if (matchMethod !== 'releaseId') {
        found = await discogsService.fetchByReleaseId(found.discogsId, { retryOnRateLimit: options.retryOnRateLimit }) ?? found;
    }

    // Determine format: the caller's, then the CSV value, then Discogs', then Vinyl
    const format = options.formatName || row.format || found.format || 'Vinyl';

    const album = await upsertAlbumFromDiscogs(found);

    // Check if already in collection
    const exists = await CollectionItem.findOne({
        user: userId,
        album: album._id,
        'format.name': format
    });
    if (exists) {
        return {
            success: false,
            skipped: true,
            reason: 'Already in collection',
            matchedData: found,
            matchMethod
        };
    }

    // Add to collection, with the format details and price an item added from search gets
    const formatDetails = found.formats?.find(f => f.name.toLowerCase() === format.toLowerCase());
    const newItem = new CollectionItem({
        user: userId,
        album: album._id,
        format: { name: format, descriptions: formatDetails?.descriptions || [], text: formatDetails?.text || '' },
        priceCache: buildPriceCache(await discogsService.getMarketplaceStats(found.discogsId, { retryOnRateLimit: options.retryOnRateLimit })),
        mediaCondition: row.mediaCondition || null,
        sleeveCondition: row.sleeveCondition || null,
        manualValue: row.value ?? null,
        customFields,
        addedAt: options.addedAt ?? row.addedAt,
        discogsInstanceId: options.discogsInstanceId
    });
    await newItem.save();
    logger.debug(`[Import] Added to collection: ${album.title} (${format})`);

    return { success: true, matchedData: found, matchMethod };
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
    const customFieldDefinitions = await loadCustomFieldDefinitions(userId);

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

    logger.info(`[Import] Started import ${logId} with ${rows.length} rows`);

    // Run processing in background (no await)
    processImportBackground(rows, importLog, userId, customFieldDefinitions).catch(err => {
        logger.error({ err }, `[Import] Background process failed for ${logId}`);
        importLog.status = 'error';
        importLog.save();
    });

    return {
        logId,
        totalRows: rows.length
    };
}

/**
 * Lookup tables for the importing user's custom fields, by hidden uuid and by
 * name. An export from another instance has unknown uuids but may still match
 * by name.
 */
async function loadCustomFieldDefinitions(userId: any): Promise<CustomFieldLookup> {
    const definitions = await loadCustomFieldsWithUuids(userId);
    const byUuid = new Map<string, string>();
    const byName = new Map<string, string>();

    for (const field of definitions) {
        const id = String(field._id);
        if (field.uuid && !byUuid.has(field.uuid)) byUuid.set(field.uuid, id);
        const name = normalizeCustomFieldName(field.name);
        if (!byName.has(name)) byName.set(name, id);
    }

    return { byUuid, byName };
}

/**
 * Background processor for import rows
 */
async function processImportBackground(
    rows: CsvRow[],
    importLog: any,
    userId: any,
    customFieldDefinitions: CustomFieldLookup
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
            inputFormat: row.formatName || row.format || '',
            inputReleaseId: row.releaseId,
            inputCatalogNumber: row.catalogNumber,
            status: 'failed'
        };

        try {
            const result = await processImportRow(row, userId, { customFieldDefinitions });

            if (result.matchedData) {
                logEntry.matchedArtist = result.matchedData.artist;
                logEntry.matchedAlbum = result.matchedData.title;
                logEntry.matchedYear = result.matchedData.year;
                logEntry.discogsId = result.matchedData.discogsId;
            }

            if (result.matchMethod) {
                logEntry.matchMethod = result.matchMethod;
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
            logger.warn({ err }, `[Import] Error processing row ${i + 1}`);
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
    logger.info(`[Import] Finished import ${importLog._id}`);

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
        logger.debug(`[Import] Log file saved: ${logFilePath}`);
    } catch (err) {
        logger.error({ err }, '[Import] Failed to save JSON log file');
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
