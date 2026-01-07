/**
 * One-time migration script to update the discogsId index to sparse
 * This allows manual albums (with null discogsId) to be created
 * 
 * Run with: npx ts-node src/scripts/fix-discogs-index.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixIndex() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault_db';

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);

    const db = mongoose.connection.db;
    if (!db) {
        console.error('Failed to connect to database');
        process.exit(1);
    }

    const albumsCollection = db.collection('albums');

    try {
        // Drop the old index
        console.log('Dropping old discogsId index...');
        await albumsCollection.dropIndex('discogsId_1');
        console.log('✅ Old index dropped successfully');
    } catch (error: any) {
        if (error.code === 27) {
            console.log('ℹ️  Index does not exist (already fixed or fresh database)');
        } else {
            throw error;
        }
    }

    // Create the new sparse index
    console.log('Creating new sparse index...');
    await albumsCollection.createIndex(
        { discogsId: 1 },
        { unique: true, sparse: true }
    );
    console.log('✅ New sparse index created successfully');

    await mongoose.disconnect();
    console.log('\n🎉 Done! Manual albums will now work correctly.');
}

fixIndex().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
