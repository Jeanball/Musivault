/**
 * Seed the value history so the stats chart is not empty on first deploy.
 *
 * Before snapshots existed, the chart was derived in the browser: it took each
 * item's current price and projected it onto the past through addedAt, building
 * a cumulative curve. This rebuilds exactly that curve as stored snapshots, so
 * users see the same history they saw yesterday. Everything recorded after this
 * point is a real measurement.
 *
 * Usage: npx ts-node src/scripts/backfill-value-snapshots.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import CollectionItem from '../models/CollectionItem';
import { rebuildValueHistory } from '../services/valueSnapshot.service';
import { logger } from '../config/logger.config';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault';

async function connectDB() {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    logger.info('✅ Connected to MongoDB');
}

export async function backfillValueSnapshots(isStandalone = false) {
    if (isStandalone) {
        await connectDB();
    }

    try {
        const userIds = await CollectionItem.distinct('user');
        logger.info(`[ValueSnapshotBackfill] Rebuilding history for ${userIds.length} user(s)...`);

        let writtenPoints = 0;

        for (const userId of userIds) {
            writtenPoints += await rebuildValueHistory(userId);
        }

        logger.info(`[ValueSnapshotBackfill] Done: ${writtenPoints} snapshot(s) written.`);
        return writtenPoints;
    } catch (err) {
        logger.error({ err }, '[ValueSnapshotBackfill] Failed');
        throw err;
    } finally {
        if (isStandalone) {
            await mongoose.disconnect();
        }
    }
}

if (require.main === module) {
    backfillValueSnapshots(true)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
