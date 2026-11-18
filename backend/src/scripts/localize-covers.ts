/**
 * Copy every album cover that still points at Discogs (`https://...`) into the
 * local covers directory, so the artwork survives a changed Discogs URL and can
 * be embedded in the CSV backup.
 *
 * Albums added from now on are copied when they are created; this backfills the
 * ones that predate the local copy.
 *
 * Usage: npx ts-node src/scripts/localize-covers.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import Album from '../models/Album';
import { downloadCoverToLocal } from '../utils/cover.utils';
import { logger } from '../config/logger.config';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault';

async function connectDB() {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    logger.info('✅ Connected to MongoDB');
}

export interface LocalizeCoversResult {
    total: number;
    localized: number;
    failed: number;
}

export async function localizeAlbumCovers(isStandalone = false): Promise<LocalizeCoversResult> {
    if (isStandalone) {
        await connectDB();
    }

    try {
        const albums = await Album.find({ cover_image: /^https?:\/\//i });
        const cache = new Map<string, string>();
        let localized = 0;
        let failed = 0;

        logger.info(`[LocalizeCovers] ${albums.length} album(s) still use a remote cover`);

        for (const album of albums) {
            const remote = album.cover_image;
            // The same release image can back several albums: download it once.
            const cached = cache.get(remote);
            const local = cached ?? await downloadCoverToLocal(remote, `${album.artist} - ${album.title}`);
            if (!cached) cache.set(remote, local);

            if (local && local !== remote) {
                album.cover_image = local;
                album.thumb = local;
                await album.save();
                localized++;
                logger.info(`[LocalizeCovers] ${album.artist} - ${album.title} -> ${local}`);
            } else {
                failed++;
                logger.warn(`[LocalizeCovers] Kept the remote cover: ${album.artist} - ${album.title}`);
            }

            // Be gentle with the image CDN.
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        logger.info(`[LocalizeCovers] Done: ${localized} localized, ${failed} left remote.`);
        return { total: albums.length, localized, failed };
    } catch (err) {
        logger.error({ err }, '[LocalizeCovers] Failed');
        throw err;
    } finally {
        if (isStandalone) {
            await mongoose.disconnect();
        }
    }
}

if (require.main === module) {
    localizeAlbumCovers(true)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
