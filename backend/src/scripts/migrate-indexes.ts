/**
 * One-time migration script to update the discogsId index to sparse
 * This allows manual albums (with null discogsId) to be created
 * 
 * Run with: npx ts-node src/scripts/fix-discogs-index.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Album from '../models/Album';
import { logger } from '../config/logger.config';

dotenv.config();

async function connectDB() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault_db';
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected.');
}

export async function migrateIndexes(isStandalone = false) {
    if (isStandalone) {
        await connectDB();
    }

    try {
        logger.info('\n========== Database Index Migration ==========\n');

        const collection = Album.collection;
        const indexes = await collection.indexes();

        logger.info('Current Indexes:');
        indexes.forEach(idx => logger.info(` - ${idx.name}: ${JSON.stringify(idx.key)} (sparse: ${idx.sparse || false}, unique: ${idx.unique || false})`));

        // specific check for discogsId index
        const discogsIndexName = 'discogsId_1';
        const existingIndex = indexes.find(idx => idx.name === discogsIndexName);

        if (existingIndex) {
            if (existingIndex.sparse) {
                logger.info(`\n✅ Index '${discogsIndexName}' is already sparse. No action needed.`);
            } else {
                logger.info(`\n⚠️ Index '${discogsIndexName}' exists but is NOT sparse.`);
                logger.info(`   Dropping index '${discogsIndexName}'...`);

                await collection.dropIndex(discogsIndexName);
                logger.info(`   ✅ Index dropped.`);

                logger.info(`   Recreating '${discogsIndexName}' as sparse unique index...`);
                // Mongoose syncIndexes is one way, but explicit creation is safer/clearer here
                await collection.createIndex({ discogsId: 1 }, { unique: true, sparse: true, background: true });
                logger.info(`   ✅ Index recreated successfully.`);
            }
        } else {
            logger.info(`\nℹ️ Index '${discogsIndexName}' not found. Creating it...`);
            await collection.createIndex({ discogsId: 1 }, { unique: true, sparse: true, background: true });
            logger.info(`   ✅ Index created successfully.`);
        }

    } catch (error) {
        logger.error({ err: error }, '\n❌ Migration failed');
        if (isStandalone) process.exit(1);
        // If not standalone, we probably want to throw so the server knows something went wrong, 
        // or just log it and continue depending on criticality. 
        // For indexes, maybe safe to continue but risky. Let's log error.
    } finally {
        if (isStandalone) {
            await mongoose.disconnect();
            logger.info('\nDisconnected from MongoDB');
            process.exit(0);
        }
        logger.info('==============================================\n');
    }
}

// Run if called directly
if (require.main === module) {
    migrateIndexes(true);
}
