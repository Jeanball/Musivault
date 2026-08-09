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
import ValueSnapshot from '../models/ValueSnapshot';
import { getValueForItem, toDayKey } from '../services/valueSnapshot.service';
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
            const items = await CollectionItem.find({ user: userId })
                .select('priceCache mediaCondition addedAt')
                .sort({ addedAt: 1 })
                .lean();

            // Sum per day first, then walk the days in order to accumulate.
            const dailyValue = new Map<string, number>();
            const dailyCount = new Map<string, number>();

            for (const item of items) {
                const value = getValueForItem(item);
                if (value <= 0) continue;

                const day = toDayKey(new Date(item.addedAt));
                dailyValue.set(day, (dailyValue.get(day) || 0) + value);
                dailyCount.set(day, (dailyCount.get(day) || 0) + 1);
            }

            const days = [...dailyValue.keys()].sort();
            let cumulativeValue = 0;
            let cumulativeCount = 0;

            for (const day of days) {
                cumulativeValue += dailyValue.get(day)!;
                cumulativeCount += dailyCount.get(day)!;

                await ValueSnapshot.findOneAndUpdate(
                    { user: userId, day },
                    {
                        $set: {
                            totalValue: Math.round(cumulativeValue * 100) / 100,
                            itemCount: cumulativeCount,
                            capturedAt: new Date(`${day}T00:00:00`),
                        }
                    },
                    { upsert: true }
                );
                writtenPoints++;
            }
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
