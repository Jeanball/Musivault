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
const DISCOGS_PAT = process.env.DISCOGS_PAT;

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

async function fetchPriceWithRetry(discogsId: number, retries: number = 0): Promise<any> {
    if (!DISCOGS_PAT) throw new Error('DISCOGS_PAT missing');
    try {
        const response = await axios.get(`https://api.discogs.com/marketplace/price_suggestions/${discogsId}`, {
            headers: {
                'Authorization': `Discogs token=${DISCOGS_PAT}`,
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
                return fetchPriceWithRetry(discogsId, retries + 1);
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

export async function migrateAlbumData(isStandalone = false) {
    if (isStandalone) {
        await connectDB();
    }

    try {
        // Ensure Album is registered in Mongoose BEFORE population
        if (!Album) throw new Error('Album model missing');

        console.log('\n========== Unified Collection Data Migration ==========\n');

        // Find all collection items and populate the album
        const collectionItems = await CollectionItem.find({}).populate('album');
        console.log(`Found ${collectionItems.length} items in your collection.\n`);

        let updatedAlbumsCount = 0;
        let updatedFormatsCount = 0;
        let updatedPricesCount = 0;
        let fullySkippedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < collectionItems.length; i++) {
            const item = collectionItems[i];
            const album = item.album as any;
            const progress = `[${i + 1}/${collectionItems.length}]`;

            if (!album?.discogsId) {
                console.log(`${progress} Skipping: No discogsId for item`);
                fullySkippedCount++;
                continue;
            }

            // 1. Determine what is missing
            const missingAlbumFields = checkMissingFields(album);
            const needsAlbumUpdate = hasMissingFields(missingAlbumFields);
            
            const hasFormatText = item.format?.text && item.format.text.trim() !== '';
            const hasFormatDescriptions = item.format?.descriptions && item.format.descriptions.length > 0;
            const needsFormatUpdate = !hasFormatText && !hasFormatDescriptions;
            
            const needsPriceUpdate = item.priceCache?.veryGoodPlus === undefined;

            if (!needsAlbumUpdate && !needsFormatUpdate && !needsPriceUpdate) {
                fullySkippedCount++;
                continue;
            }

            console.log(`${progress} Processing: ${album.title} (ID: ${album.discogsId})`);
            
            let itemChanged = false;
            let albumChanged = false;

            try {
                // If we need album data OR format data, fetch the release endpoint
                if (needsAlbumUpdate || needsFormatUpdate) {
                    const data = await fetchWithRetry(album.discogsId);
                    
                    // --- Handle Album Data ---
                    if (needsAlbumUpdate) {
                        const missingStr = formatMissingFields(missingAlbumFields);
                        console.log(`  🔍 Needs Album Data (${missingStr})`);
                        
                        // Update styles
                        if (missingAlbumFields.styles && data.styles?.length) {
                            album.styles = data.styles;
                            albumChanged = true;
                            console.log(`  ✅ styles added: ${data.styles.length}`);
                        }

                        // Update tracklist
                        const tracklistNeedsArtist = album.tracklist?.some((t: any) => !t.artist || t.artist === '');
                        if ((missingAlbumFields.tracklist || tracklistNeedsArtist) && data.tracklist?.length) {
                            album.tracklist = data.tracklist.map(t => ({
                                position: t.position || '',
                                title: t.title || '',
                                duration: t.duration || '',
                                artist: t.artists?.map(a => a.name).join(', ') || ''
                            }));
                            albumChanged = true;
                            console.log(`  ✅ tracklist added: ${data.tracklist.length} tracks`);
                        }

                        // Update labels
                        if (missingAlbumFields.labels && data.labels?.length) {
                            album.labels = data.labels.map(l => ({
                                name: l.name || '',
                                catno: l.catno || ''
                            }));
                            albumChanged = true;
                            console.log(`  ✅ labels added`);
                        }

                        // Update cover_image
                        if (missingAlbumFields.cover_image) {
                            const newCoverImage = data.images?.find(img => img.type === 'primary')?.uri || data.images?.[0]?.uri;
                            if (newCoverImage) {
                                album.cover_image = newCoverImage;
                                albumChanged = true;
                                console.log(`  ✅ cover_image updated`);
                            }
                        }

                        // Update year
                        if (missingAlbumFields.year && data.year) {
                            album.year = data.year.toString();
                            albumChanged = true;
                            console.log(`  ✅ year added: ${data.year}`);
                        }
                    }

                    // --- Handle Format Data ---
                    if (needsFormatUpdate) {
                        console.log(`  🔍 Needs Format Data`);
                        if (data.formats && data.formats.length > 0) {
                            const matchingFormat = data.formats.find(f =>
                                f.name.toLowerCase() === item.format.name.toLowerCase()
                            ) || data.formats[0];

                            if (matchingFormat) {
                                item.format.text = matchingFormat.text || '';
                                item.format.descriptions = matchingFormat.descriptions || [];
                                itemChanged = true;
                                console.log(`  ✅ format updated`);
                            }
                        }
                    }

                    // Sleep to respect rate limits if we made an API call
                    await sleep(RATE_LIMIT_DELAY_MS);
                }

                // --- Handle Price Data ---
                if (needsPriceUpdate) {
                    console.log(`  🔍 Needs Price Data`);
                    if (!DISCOGS_PAT) {
                        console.log(`  ⚠️ Skipping Price fetch: DISCOGS_PAT missing in .env`);
                    } else {
                        const suggestions = await fetchPriceWithRetry(album.discogsId);
                        const currency = (Object.values(suggestions || {})[0] as any)?.currency || 'USD';
                        
                        item.priceCache = {
                            mint: suggestions?.['Mint (M)']?.value ?? undefined,
                            nearMint: suggestions?.['Near Mint (NM or M-)']?.value ?? undefined,
                            veryGoodPlus: suggestions?.['Very Good Plus (VG+)']?.value ?? undefined,
                            veryGood: suggestions?.['Very Good (VG)']?.value ?? undefined,
                            goodPlus: suggestions?.['Good Plus (G+)']?.value ?? undefined,
                            good: suggestions?.['Good (G)']?.value ?? undefined,
                            fair: suggestions?.['Fair (F)']?.value ?? undefined,
                            poor: suggestions?.['Poor (P)']?.value ?? undefined,
                            currency,
                            updatedAt: new Date()
                        };
                        item.markModified('priceCache');
                        itemChanged = true;

                        if (suggestions && Object.keys(suggestions).length > 0) {
                            console.log(`  ✅ price added: ${item.priceCache.veryGoodPlus} ${currency} (VG+)`);
                        } else {
                            console.log(`  ⚠️ No price data found in marketplace`);
                        }

                        // Sleep to respect rate limits if we made an API call
                        await sleep(RATE_LIMIT_DELAY_MS);
                    }
                }

                // --- Save Changes ---
                if (albumChanged) {
                    await album.save();
                    updatedAlbumsCount++;
                }
                
                if (itemChanged) {
                    await item.save();
                    if (needsFormatUpdate) updatedFormatsCount++;
                    if (needsPriceUpdate) updatedPricesCount++;
                }

            } catch (error: any) {
                console.error(`  ❌ Failed: ${error.message}`);
                errorCount++;
                await sleep(RATE_LIMIT_DELAY_MS);
            }
        }

        console.log('\n========== Migration Summary ==========');
        console.log(`Albums updated with new data: ${updatedAlbumsCount}`);
        console.log(`Items updated with formats:   ${updatedFormatsCount}`);
        console.log(`Items updated with prices:    ${updatedPricesCount}`);
        console.log(`Items already complete:       ${fullySkippedCount}`);
        console.log(`Errors encountered:           ${errorCount}`);
        console.log('=======================================');

    } catch (error) {
        console.error('Migration failed:', error);
        if (isStandalone) process.exit(1);
    } finally {
        if (isStandalone) {
            await mongoose.disconnect();
            console.log('\nDisconnected from MongoDB');
            process.exit(0);
        }
    }
}

if (require.main === module) {
    migrateAlbumData(true);
}
