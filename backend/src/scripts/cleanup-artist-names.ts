/**
 * Migration script to cleanup artist names by removing Discogs numbering suffixes.
 * Example: "Alpha Wolf (2)" -> "Alpha Wolf"
 * 
 * Usage: npx ts-node src/scripts/cleanup-artist-names.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import Album from '../models/Album';
import { logger } from '../config/logger.config';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault';

// ... imports

async function connectDB() {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    logger.info('✅ Connected to MongoDB');
}

export async function cleanupArtistNames(isStandalone = false) {
    if (isStandalone) {
        await connectDB();
    }

    try {
        const albums = await Album.find({});
        logger.info(`Checking ${albums.length} albums for artist name suffixes...`);

        let updatedCount = 0;
        const suffixRegex = /\s\(\d+\)$/;

        for (const album of albums) {
            if (suffixRegex.test(album.artist)) {
                const oldName = album.artist;
                const newName = album.artist.replace(suffixRegex, '');

                album.artist = newName;
                await album.save();

                logger.info(`Updated: "${oldName}" -> "${newName}"`);
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            logger.info('\n========== Cleanup Summary ==========');
            logger.info(`Total Albums Scanned: ${albums.length}`);
            logger.info(`Albums Updated: ${updatedCount}`);
            logger.info('======================================');
        } else {
            logger.info('✅ Artist names are clean.');
        }

    } catch (error) {
        logger.error({ err: error }, '❌ Migration failed');
        if (isStandalone) process.exit(1);
    } finally {
        if (isStandalone) {
            await mongoose.disconnect();
            logger.info('Disconnected from MongoDB');
            process.exit(0);
        }
    }
}

// Run if called directly
if (require.main === module) {
    cleanupArtistNames(true);
}
