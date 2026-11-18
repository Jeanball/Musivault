/**
 * Give every custom field definition the hidden uuid that CSV exports embed in
 * their column headers. Without it, an export written before a field was
 * renamed could only be matched by name, and the values would be lost.
 *
 * Fields created after the uuid was introduced get one automatically; this
 * backfills the ones that predate it.
 *
 * Usage: npx ts-node src/scripts/backfill-custom-field-uuids.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { randomUUID } from 'crypto';
import CustomFieldDefinition from '../models/CustomFieldDefinition';
import { logger } from '../config/logger.config';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault';

async function connectDB() {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    logger.info('✅ Connected to MongoDB');
}

export async function backfillCustomFieldUuids(isStandalone = false): Promise<number> {
    if (isStandalone) {
        await connectDB();
    }

    try {
        // `null` also matches documents where the field does not exist yet.
        const fields = await CustomFieldDefinition.find({ uuid: { $in: [null, ''] } }).select('+uuid');
        let written = 0;

        for (const field of fields) {
            field.uuid = randomUUID();
            await field.save();
            written++;
        }

        logger.info(`[CustomFieldUuids] Assigned a uuid to ${written} field(s).`);
        return written;
    } catch (err) {
        logger.error({ err }, '[CustomFieldUuids] Failed');
        throw err;
    } finally {
        if (isStandalone) {
            await mongoose.disconnect();
        }
    }
}

if (require.main === module) {
    backfillCustomFieldUuids(true)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
