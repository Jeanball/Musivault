
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import path from 'path';
import Album from '../models/Album';

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

async function fetchWithRetry(discogsId: number, retries: number = 0): Promise<any> {
    try {
        const response = await axios.get(`https://api.discogs.com/releases/${discogsId}`, {
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

async function migrateStyles() {
    await connectDB();

    try {
        // Find albums that have a discogsId but no styles
        const albums = await Album.find({
            discogsId: { $exists: true, $ne: null }
        });

        console.log(`Found ${albums.length} albums to check.`);
        console.log(`Rate limit: 1 request every ${RATE_LIMIT_DELAY_MS / 1000} seconds`);
        console.log(`Estimated time: ${Math.ceil((albums.length * RATE_LIMIT_DELAY_MS) / 60000)} minutes\n`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < albums.length; i++) {
            const album = albums[i];
            const progress = `[${i + 1}/${albums.length}]`;

            if (album.styles && album.styles.length > 0) {
                // Skip if already populated
                skippedCount++;
                continue;
            }

            console.log(`${progress} Processing: ${album.title} (ID: ${album.discogsId})...`);

            try {
                const data = await fetchWithRetry(album.discogsId);
                const styles = data.styles || [];

                if (styles.length > 0) {
                    album.styles = styles;
                    await album.save();
                    console.log(`  ✅ Updated: ${styles.join(', ')}`);
                    updatedCount++;
                } else {
                    console.log(`  ⚠️ No styles found on Discogs`);
                    skippedCount++;
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

        console.log('\n========== Migration Summary ==========');
        console.log(`Total Albums: ${albums.length}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Skipped (Already had styles or empty): ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('========================================');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);
    }
}

migrateStyles();
