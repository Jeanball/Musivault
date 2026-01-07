/**
 * Migration script to backfill missing album data from Discogs
 * 
 * This script checks all albums in the database and fetches any missing fields:
 * - styles
 * - tracklist
 * - labels
 * - cover_image
 * - year
 * 
 * It also updates CollectionItem format details:
 * - format.text (vinyl color variant like "Sea Glass Transparent")
 * - format.descriptions (LP, Album, Limited Edition, etc.)
 * 
 * Usage: npx ts-node src/scripts/migrate-album-data.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import path from 'path';
import Album from '../models/Album';
import CollectionItem from '../models/CollectionItem';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DISCOGS_SECRET = process.env.DISCOGS_SECRET;
if (!DISCOGS_SECRET) {
    console.error('❌ DISCOGS_SECRET is missing in .env');
    process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault';

// Discogs rate limit: 25 requests/minute for authenticated users
// That's 1 request every 2.4 seconds, we'll use 2.5 seconds to be safe
const RATE_LIMIT_DELAY_MS = 2500;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 60000; // Wait 1 minute on rate limit

interface DiscogsFormat {
    name: string;
    qty?: string;
    text?: string;
    descriptions?: string[];
}

interface DiscogsRelease {
    id: number;
    title: string;
    artists?: { name: string }[];
    year?: number;
    images?: { type: string; uri: string }[];
    styles?: string[];
    tracklist?: { position: string; title: string; duration: string; artists?: { name: string }[] }[];
    labels?: { name: string; catno: string }[];
    formats?: DiscogsFormat[];
}

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(discogsId: number, retries: number = 0): Promise<DiscogsRelease> {
    try {
        const response = await axios.get<DiscogsRelease>(`https://api.discogs.com/releases/${discogsId}`, {
            headers: {
                'Authorization': `Discogs token=${DISCOGS_SECRET}`,
                'User-Agent': 'Musivault/1.5 (+https://github.com/Musivault)'
            }
        });
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 429) {
            // Rate limited
            if (retries < MAX_RETRIES) {
                console.log(`  ⏳ Rate limited. Waiting 60 seconds before retry ${retries + 1}/${MAX_RETRIES}...`);
                await sleep(RETRY_DELAY_MS);
                return fetchWithRetry(discogsId, retries + 1);
            }
            throw new Error('Rate limit exceeded, max retries reached');
        }
        throw error;
    }
}

interface MissingFields {
    styles: boolean;
    tracklist: boolean;
    labels: boolean;
    cover_image: boolean;
    year: boolean;
}

function checkMissingFields(album: any): MissingFields {
    return {
        styles: !album.styles || album.styles.length === 0,
        tracklist: !album.tracklist || album.tracklist.length === 0,
        labels: !album.labels || album.labels.length === 0,
        cover_image: !album.cover_image || album.cover_image === '',
        year: !album.year || album.year === '',
    };
}

function hasMissingFields(missing: MissingFields): boolean {
    return missing.styles || missing.tracklist || missing.labels || missing.cover_image || missing.year;
}

function formatMissingFields(missing: MissingFields): string {
    const fields: string[] = [];
    if (missing.styles) fields.push('styles');
    if (missing.tracklist) fields.push('tracklist');
    if (missing.labels) fields.push('labels');
    if (missing.cover_image) fields.push('cover_image');
    if (missing.year) fields.push('year');
    return fields.join(', ');
}

async function migrateAlbumData() {
    await connectDB();

    try {
        // ==================== PHASE 1: ALBUM DATA ====================
        console.log('\n========== PHASE 1: Album Data Migration ==========\n');

        // Find all albums with a discogsId
        const albums = await Album.find({
            discogsId: { $exists: true, $ne: null }
        });

        console.log(`Found ${albums.length} albums to check.`);

        // First pass: count albums that need updates
        let needsUpdateCount = 0;
        for (const album of albums) {
            const missing = checkMissingFields(album);
            if (hasMissingFields(missing)) {
                needsUpdateCount++;
            }
        }

        console.log(`Albums needing updates: ${needsUpdateCount}`);
        console.log(`Rate limit: 1 request every ${RATE_LIMIT_DELAY_MS / 1000} seconds`);
        console.log(`Estimated time: ${Math.ceil((needsUpdateCount * RATE_LIMIT_DELAY_MS) / 60000)} minutes\n`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < albums.length; i++) {
            const album = albums[i];
            const progress = `[${i + 1}/${albums.length}]`;
            const missing = checkMissingFields(album);

            if (!hasMissingFields(missing)) {
                // All fields are present, skip
                skippedCount++;
                continue;
            }

            const missingStr = formatMissingFields(missing);
            console.log(`${progress} Processing: ${album.title} (ID: ${album.discogsId})`);
            console.log(`  Missing: ${missingStr}`);

            try {
                const data = await fetchWithRetry(album.discogsId!);
                let updated = false;

                // Update styles if missing
                if (missing.styles && data.styles && data.styles.length > 0) {
                    album.styles = data.styles;
                    updated = true;
                    console.log(`  ✅ styles: ${data.styles.join(', ')}`);
                }

                // Update tracklist if missing OR if it exists but lacks artist data
                const tracklistNeedsArtist = album.tracklist && album.tracklist.length > 0 &&
                    album.tracklist.some((t: any) => !t.artist || t.artist === '');
                if ((missing.tracklist || tracklistNeedsArtist) && data.tracklist && data.tracklist.length > 0) {
                    album.tracklist = data.tracklist.map(t => ({
                        position: t.position || '',
                        title: t.title || '',
                        duration: t.duration || '',
                        artist: t.artists?.map(a => a.name).join(', ') || ''
                    }));
                    updated = true;
                    console.log(`  ✅ tracklist: ${data.tracklist.length} tracks (with artists)`);
                }

                // Update labels if missing
                if (missing.labels && data.labels && data.labels.length > 0) {
                    album.labels = data.labels.map(l => ({
                        name: l.name || '',
                        catno: l.catno || ''
                    }));
                    updated = true;
                    console.log(`  ✅ labels: ${data.labels.map(l => l.name).join(', ')}`);
                }

                // Update cover_image if missing
                if (missing.cover_image) {
                    const primaryImage = data.images?.find(img => img.type === 'primary')?.uri;
                    const fallbackImage = data.images?.[0]?.uri;
                    const newCoverImage = primaryImage || fallbackImage;
                    if (newCoverImage) {
                        album.cover_image = newCoverImage;
                        updated = true;
                        console.log(`  ✅ cover_image: updated`);
                    }
                }

                // Update year if missing
                if (missing.year && data.year) {
                    album.year = data.year.toString();
                    updated = true;
                    console.log(`  ✅ year: ${data.year}`);
                }

                if (updated) {
                    await album.save();
                    updatedCount++;
                } else {
                    console.log(`  ⚠️ No data available on Discogs to fill missing fields`);
                }

                // Wait to respect rate limit
                await sleep(RATE_LIMIT_DELAY_MS);

            } catch (error: any) {
                console.error(`  ❌ Failed: ${error.message}`);
                if (error.response?.status === 404) {
                    console.error(`     Release not found on Discogs.`);
                }
                errorCount++;

                // Still wait to avoid hammering the API
                await sleep(RATE_LIMIT_DELAY_MS);
            }
        }

        console.log('\n========== Album Migration Summary ==========');
        console.log(`Total Albums: ${albums.length}`);
        console.log(`Needed Updates: ${needsUpdateCount}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Skipped (Complete): ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('=============================================\n');

        // ==================== PHASE 2: FORMAT DETAILS ====================
        console.log('\n========== PHASE 2: Collection Format Details ==========\n');

        // Find all collection items with missing format details
        const collectionItems = await CollectionItem.find({}).populate('album');

        // Filter items that need format updates (missing text or descriptions)
        const itemsNeedingUpdate = collectionItems.filter(item => {
            const hasText = item.format?.text && item.format.text.trim() !== '';
            const hasDescriptions = item.format?.descriptions && item.format.descriptions.length > 0;
            return !hasText && !hasDescriptions;
        });

        console.log(`Found ${collectionItems.length} collection items total.`);
        console.log(`Items needing format updates: ${itemsNeedingUpdate.length}`);
        console.log(`Estimated time: ${Math.ceil((itemsNeedingUpdate.length * RATE_LIMIT_DELAY_MS) / 60000)} minutes\n`);

        let formatUpdatedCount = 0;
        let formatSkippedCount = 0;
        let formatErrorCount = 0;

        for (let i = 0; i < itemsNeedingUpdate.length; i++) {
            const item = itemsNeedingUpdate[i];
            const album = item.album as any;
            const progress = `[${i + 1}/${itemsNeedingUpdate.length}]`;

            if (!album?.discogsId) {
                console.log(`${progress} Skipping: No discogsId for album`);
                formatSkippedCount++;
                continue;
            }

            console.log(`${progress} Processing: ${album.title} (ID: ${album.discogsId})`);

            try {
                const data = await fetchWithRetry(album.discogsId);

                if (data.formats && data.formats.length > 0) {
                    // Find the best matching format based on the item's format.name
                    const matchingFormat = data.formats.find(f =>
                        f.name.toLowerCase() === item.format.name.toLowerCase()
                    ) || data.formats[0];

                    if (matchingFormat) {
                        item.format.text = matchingFormat.text || '';
                        item.format.descriptions = matchingFormat.descriptions || [];
                        await item.save();
                        formatUpdatedCount++;

                        const textInfo = matchingFormat.text ? `"${matchingFormat.text}"` : 'none';
                        const descInfo = matchingFormat.descriptions?.join(', ') || 'none';
                        console.log(`  ✅ Updated: text=${textInfo}, descriptions=${descInfo}`);
                    } else {
                        console.log(`  ⚠️ No format data found on Discogs`);
                    }
                } else {
                    console.log(`  ⚠️ No formats in release data`);
                }

                await sleep(RATE_LIMIT_DELAY_MS);

            } catch (error: any) {
                console.error(`  ❌ Failed: ${error.message}`);
                formatErrorCount++;
                await sleep(RATE_LIMIT_DELAY_MS);
            }
        }

        console.log('\n========== Format Details Summary ==========');
        console.log(`Total Collection Items: ${collectionItems.length}`);
        console.log(`Needed Updates: ${itemsNeedingUpdate.length}`);
        console.log(`Updated: ${formatUpdatedCount}`);
        console.log(`Skipped: ${formatSkippedCount}`);
        console.log(`Errors: ${formatErrorCount}`);
        console.log('============================================');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);
    }
}

migrateAlbumData();

