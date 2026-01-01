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

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault';

async function cleanupArtistNames() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const albums = await Album.find({});
        console.log(`Checking ${albums.length} albums for artist name suffixes...`);

        let updatedCount = 0;
        const suffixRegex = /\s\(\d+\)$/;

        for (const album of albums) {
            if (suffixRegex.test(album.artist)) {
                const oldName = album.artist;
                const newName = album.artist.replace(suffixRegex, '');

                album.artist = newName;
                await album.save();

                console.log(`Updated: "${oldName}" -> "${newName}"`);
                updatedCount++;
            }
        }

        console.log('\n========== Migration Summary ==========');
        console.log(`Total Albums Scanned: ${albums.length}`);
        console.log(`Albums Updated: ${updatedCount}`);
        console.log('========================================');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

cleanupArtistNames();
