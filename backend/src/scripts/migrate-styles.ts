
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

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function migrateGenres() {
    await connectDB();

    try {
        // Find albums that have no genres or empty genres array
        // We also want to update albums where genres might be missing but discogsId exists
        const albums = await Album.find({
            discogsId: { $exists: true, $ne: null }
        });

        console.log(`Found ${albums.length} albums to check.`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const album of albums) {
            if (album.styles && album.styles.length > 0) {
                // Skip if already populated (optional: remove this check to force update all)
                // console.log(`Skipping ${album.title} - already has styles`);
                skippedCount++;
                continue;
            }

            console.log(`Processing: ${album.title} (ID: ${album.discogsId})...`);

            try {
                const response = await axios.get(`https://api.discogs.com/releases/${album.discogsId}`, {
                    headers: {
                        'Authorization': `Discogs token=${DISCOGS_SECRET}`,
                        'User-Agent': 'MusivaultMigration/1.0'
                    }
                });

                const data = response.data;
                const styles = data.styles || [];

                if (styles.length > 0) {
                    album.styles = styles;
                    await album.save();
                    console.log(`  ✅ Updated ${album.title}: ${styles.join(', ')}`);
                    updatedCount++;
                } else {
                    console.log(`  ⚠️ No styles found for ${album.title}`);
                    skippedCount++;
                }

                // Respect Discogs rate limit (60 req/min -> ~1 req/sec)
                await new Promise(resolve => setTimeout(resolve, 1100));

            } catch (error: any) {
                console.error(`  ❌ Failed to fetch/update ${album.title}:`, error.message);
                if (error.response && error.response.status === 404) {
                    console.error(`     Release not found on Discogs.`);
                }
                errorCount++;
            }
        }

        console.log('\nMigration Summary:');
        console.log(`Total Albums: ${albums.length}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Skipped (Already done or empty): ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

migrateGenres();
