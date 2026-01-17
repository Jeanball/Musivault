/**
 * One-time migration script to update the discogsId index to sparse
 * This allows manual albums (with null discogsId) to be created
 * 
 * Run with: npx ts-node src/scripts/fix-discogs-index.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Album from '../models/Album';

dotenv.config();

async function connectDB() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault_db';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected.');
}

export async function migrateIndexes(isStandalone = false) {
    if (isStandalone) {
        await connectDB();
    }

    try {
        console.log('\n========== Database Index Migration ==========\n');

        const collection = Album.collection;
        const indexes = await collection.indexes();

        console.log('Current Indexes:');
        indexes.forEach(idx => console.log(` - ${idx.name}: ${JSON.stringify(idx.key)} (sparse: ${idx.sparse || false}, unique: ${idx.unique || false})`));

        // specific check for discogsId index
        const discogsIndexName = 'discogsId_1';
        const existingIndex = indexes.find(idx => idx.name === discogsIndexName);

        if (existingIndex) {
            if (existingIndex.sparse) {
                console.log(`\n✅ Index '${discogsIndexName}' is already sparse. No action needed.`);
            } else {
                console.log(`\n⚠️ Index '${discogsIndexName}' exists but is NOT sparse.`);
                console.log(`   Dropping index '${discogsIndexName}'...`);

                await collection.dropIndex(discogsIndexName);
                console.log(`   ✅ Index dropped.`);

                console.log(`   Recreating '${discogsIndexName}' as sparse unique index...`);
                // Mongoose syncIndexes is one way, but explicit creation is safer/clearer here
                await collection.createIndex({ discogsId: 1 }, { unique: true, sparse: true, background: true });
                console.log(`   ✅ Index recreated successfully.`);
            }
        } else {
            console.log(`\nℹ️ Index '${discogsIndexName}' not found. Creating it...`);
            await collection.createIndex({ discogsId: 1 }, { unique: true, sparse: true, background: true });
            console.log(`   ✅ Index created successfully.`);
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        if (isStandalone) process.exit(1);
        // If not standalone, we probably want to throw so the server knows something went wrong, 
        // or just log it and continue depending on criticality. 
        // For indexes, maybe safe to continue but risky. Let's log error.
    } finally {
        if (isStandalone) {
            await mongoose.disconnect();
            console.log('\nDisconnected from MongoDB');
            process.exit(0);
        }
        console.log('==============================================\n');
    }
}

// Run if called directly
if (require.main === module) {
    migrateIndexes(true);
}
