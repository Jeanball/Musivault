/**
 * Migration script to backfill missing album data from Discogs
 * 
 * This script checks all albums in the database and fetches any missing fields:
 * - styles
 * - tracklist
 * - labels (including the Discogs label id used to link to the label's own site)
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
import { logger } from '../config/logger.config';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DISCOGS_SECRET = process.env.DISCOGS_SECRET;
const DISCOGS_PAT = process.env.DISCOGS_PAT;

if (!DISCOGS_SECRET) {
    logger.error('❌ DISCOGS_SECRET is missing in .env');
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
    labels?: { id?: number; name: string; catno: string }[];
    formats?: DiscogsFormat[];
}

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI);
        logger.info('✅ Connected to MongoDB');
    } catch (error) {
        logger.error({ err: error }, '❌ MongoDB connection error');
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
                logger.info(`  ⏳ Rate limited. Waiting 60 seconds before retry ${retries + 1}/${MAX_RETRIES}...`);
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
                logger.info(`  ⏳ Rate limited. Waiting 60 seconds before retry ${retries + 1}/${MAX_RETRIES}...`);
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
    /** Labels are stored but predate the Discogs label id, so they can't link to the label's site */
    labelIds: boolean;
    cover_image: boolean;
    year: boolean;
}

function checkMissingFields(album: any): MissingFields {
    const hasLabels = !!album.labels?.length;

    return {
        styles: !album.styles || album.styles.length === 0,
        tracklist: !album.tracklist || album.tracklist.length === 0,
        labels: !hasLabels,
        labelIds: hasLabels && album.labels.some((l: any) => !l.discogsId),
        cover_image: !album.cover_image || album.cover_image === '',
        year: !album.year || album.year === '',
    };
}

function hasMissingFields(missing: MissingFields): boolean {
    return Object.values(missing).some(Boolean);
}

function formatMissingFields(missing: MissingFields): string {
    const fields: string[] = [];
    if (missing.styles) fields.push('styles');
    if (missing.tracklist) fields.push('tracklist');
    if (missing.labels) fields.push('labels');
    if (missing.labelIds) fields.push('label ids');
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

        logger.info('\n========== Unified Collection Data Migration ==========\n');

        // Find all collection items and populate the album
        const collectionItems = await CollectionItem.find({}).populate('album');
        logger.info(`Found ${collectionItems.length} items in your collection.\n`);

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
                logger.info(`${progress} Skipping: No discogsId for item`);
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

            logger.info(`${progress} Processing: ${album.title} (ID: ${album.discogsId})`);
            
            let itemChanged = false;
            let albumChanged = false;

            try {
                // If we need album data OR format data, fetch the release endpoint
                if (needsAlbumUpdate || needsFormatUpdate) {
                    const data = await fetchWithRetry(album.discogsId);
                    
                    // --- Handle Album Data ---
                    if (needsAlbumUpdate) {
                        const missingStr = formatMissingFields(missingAlbumFields);
                        logger.info(`  🔍 Needs Album Data (${missingStr})`);
                        
                        // Update styles
                        if (missingAlbumFields.styles && data.styles?.length) {
                            album.styles = data.styles;
                            albumChanged = true;
                            logger.info(`  ✅ styles added: ${data.styles.length}`);
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
                            logger.info(`  ✅ tracklist added: ${data.tracklist.length} tracks`);
                        }

                        // Update labels
                        if (missingAlbumFields.labels && data.labels?.length) {
                            album.labels = data.labels.map(l => ({
                                name: l.name || '',
                                catno: l.catno || '',
                                discogsId: l.id
                            }));
                            albumChanged = true;
                            logger.info(`  ✅ labels added`);
                        } else if (missingAlbumFields.labelIds && data.labels?.length) {
                            // Labels are already there, only the Discogs id is missing: match on
                            // name (then position) so manually edited catalog numbers survive.
                            let idsAdded = 0;
                            album.labels = album.labels.map((label: any, index: number) => {
                                if (label.discogsId) return label;

                                const match = data.labels!.find(
                                    l => l.name?.toLowerCase() === label.name?.toLowerCase()
                                ) || data.labels![index];

                                if (!match?.id) return label;

                                idsAdded++;
                                return { name: label.name, catno: label.catno, discogsId: match.id };
                            });

                            if (idsAdded > 0) {
                                album.markModified('labels');
                                albumChanged = true;
                                logger.info(`  ✅ label ids added: ${idsAdded}`);
                            }
                        }

                        // Update cover_image
                        if (missingAlbumFields.cover_image) {
                            const newCoverImage = data.images?.find(img => img.type === 'primary')?.uri || data.images?.[0]?.uri;
                            if (newCoverImage) {
                                album.cover_image = newCoverImage;
                                albumChanged = true;
                                logger.info(`  ✅ cover_image updated`);
                            }
                        }

                        // Update year
                        if (missingAlbumFields.year && data.year) {
                            album.year = data.year.toString();
                            albumChanged = true;
                            logger.info(`  ✅ year added: ${data.year}`);
                        }
                    }

                    // --- Handle Format Data ---
                    if (needsFormatUpdate) {
                        logger.info(`  🔍 Needs Format Data`);
                        if (data.formats && data.formats.length > 0) {
                            const matchingFormat = data.formats.find(f =>
                                f.name.toLowerCase() === item.format.name.toLowerCase()
                            ) || data.formats[0];

                            if (matchingFormat) {
                                item.format.text = matchingFormat.text || '';
                                item.format.descriptions = matchingFormat.descriptions || [];
                                itemChanged = true;
                                logger.info(`  ✅ format updated`);
                            }
                        }
                    }

                    // Sleep to respect rate limits if we made an API call
                    await sleep(RATE_LIMIT_DELAY_MS);
                }

                // --- Handle Price Data ---
                if (needsPriceUpdate) {
                    logger.info(`  🔍 Needs Price Data`);
                    if (!DISCOGS_PAT) {
                        logger.warn(`  ⚠️ Skipping Price fetch: DISCOGS_PAT missing in .env`);
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
                            logger.info(`  ✅ price added: ${item.priceCache.veryGoodPlus} ${currency} (VG+)`);
                        } else {
                            logger.warn(`  ⚠️ No price data found in marketplace`);
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
                logger.error({ err: error }, `  ❌ Failed`);
                errorCount++;
                await sleep(RATE_LIMIT_DELAY_MS);
            }
        }

        logger.info('\n========== Migration Summary ==========');
        logger.info(`Albums updated with new data: ${updatedAlbumsCount}`);
        logger.info(`Items updated with formats:   ${updatedFormatsCount}`);
        logger.info(`Items updated with prices:    ${updatedPricesCount}`);
        logger.info(`Items already complete:       ${fullySkippedCount}`);
        logger.info(`Errors encountered:           ${errorCount}`);
        logger.info('=======================================');

    } catch (error) {
        logger.error({ err: error }, 'Migration failed');
        if (isStandalone) process.exit(1);
    } finally {
        if (isStandalone) {
            await mongoose.disconnect();
            logger.info('\nDisconnected from MongoDB');
            process.exit(0);
        }
    }
}

if (require.main === module) {
    migrateAlbumData(true);
}
