/**
 * Verify collection item formats against their linked Discogs releases.
 *
 * Musivault is treated as the source of truth for the intended format.
 * This script audits every collection item with a Discogs release ID and
 * reports where the stored item format does not match the Discogs release.
 *
 * Usage:
 *   npx ts-node src/scripts/verify-collection-formats.ts
 *   npm run verify-collection-formats
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import CollectionItem from '../models/CollectionItem';
import Album from '../models/Album';
import '../models/User';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DISCOGS_SECRET = process.env.DISCOGS_SECRET;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault';
const RATE_LIMIT_DELAY_MS = 2500;
const REPORTS_DIR = path.join(__dirname, '../../logs/audits');

interface DiscogsRelease {
    id: number;
    title: string;
    artists?: { name: string }[];
    formats?: { name?: string; descriptions?: string[] }[];
}

interface VerificationEntry {
    itemId: string;
    username?: string;
    storedArtist: string;
    storedAlbum: string;
    storedYear?: string;
    storedFormat: string;
    discogsId: number;
    detectedDiscogsFormat: string;
    discogsFormats: string[];
    status: 'match' | 'mismatch' | 'unknown' | 'error';
    reason?: string;
}

function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

async function connectDB() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeStoredFormat(input?: string | null): string {
    const value = (input || '').toLowerCase().trim();
    if (value.includes('vinyl') || value.includes('lp')) return 'Vinyl';
    if (value.includes('cd')) return 'CD';
    if (value.includes('cassette')) return 'Cassette';
    return input || 'Unknown';
}

function detectDiscogsFormat(formats?: { name?: string; descriptions?: string[] }[]): string {
    if (!formats?.length) return 'Unknown';

    const formatNames = formats
        .map(format => format.name?.toLowerCase().trim())
        .filter(Boolean) as string[];

    if (formatNames.some(name => name.includes('vinyl') || name.includes('lp') || name.includes('12"') || name.includes('7"'))) {
        return 'Vinyl';
    }

    if (formatNames.some(name => name.includes('cd') || name.includes('compact disc') || name.includes('cdr'))) {
        return 'CD';
    }

    if (formatNames.some(name => name.includes('cassette'))) {
        return 'Cassette';
    }

    return 'Unknown';
}

async function fetchDiscogsRelease(discogsId: number): Promise<DiscogsRelease> {
    if (!DISCOGS_SECRET) {
        throw new Error('DISCOGS_SECRET is missing in .env');
    }

    await sleep(RATE_LIMIT_DELAY_MS);

    const response = await axios.get<DiscogsRelease>(`https://api.discogs.com/releases/${discogsId}`, {
        headers: {
            Authorization: `Discogs token=${DISCOGS_SECRET}`,
            'User-Agent': 'Musivault/1.10 (+https://github.com/Musivault)'
        }
    });

    return response.data;
}

async function run() {
    ensureReportsDir();
    await connectDB();

    try {
        if (!Album) {
            throw new Error('Album model missing');
        }

        const items = await CollectionItem.find({})
            .populate('album')
            .populate('user', 'username')
            .lean();

        console.log(`Verifying ${items.length} collection items...`);

        const entries: VerificationEntry[] = [];
        let matches = 0;
        let mismatches = 0;
        let unknown = 0;
        let errors = 0;

        for (let index = 0; index < items.length; index++) {
            const item = items[index] as any;
            const album = item.album;
            const username = item.user?.username;

            if (!album?.discogsId) {
                entries.push({
                    itemId: String(item._id),
                    username,
                    storedArtist: album?.artist || 'Unknown',
                    storedAlbum: album?.title || 'Unknown',
                    storedYear: album?.year || '',
                    storedFormat: item.format?.name || 'Unknown',
                    discogsId: 0,
                    detectedDiscogsFormat: 'Unknown',
                    discogsFormats: [],
                    status: 'unknown',
                    reason: 'Missing discogsId'
                });
                unknown++;
                continue;
            }

            const storedFormat = normalizeStoredFormat(item.format?.name);
            console.log(`[${index + 1}/${items.length}] Checking ${album.artist} - ${album.title} (${storedFormat})`);

            try {
                const release = await fetchDiscogsRelease(album.discogsId);
                const detectedDiscogsFormat = detectDiscogsFormat(release.formats);
                const discogsFormats = (release.formats || [])
                    .map(format => format.name)
                    .filter(Boolean) as string[];

                const baseEntry: VerificationEntry = {
                    itemId: String(item._id),
                    username,
                    storedArtist: album.artist,
                    storedAlbum: album.title,
                    storedYear: album.year,
                    storedFormat,
                    discogsId: album.discogsId,
                    detectedDiscogsFormat,
                    discogsFormats,
                    status: 'match'
                };

                if (detectedDiscogsFormat === 'Unknown') {
                    baseEntry.status = 'unknown';
                    baseEntry.reason = 'Discogs format could not be classified';
                    unknown++;
                } else if (storedFormat !== detectedDiscogsFormat) {
                    baseEntry.status = 'mismatch';
                    baseEntry.reason = `Musivault says ${storedFormat}, Discogs release says ${detectedDiscogsFormat}`;
                    mismatches++;
                } else {
                    matches++;
                }

                entries.push(baseEntry);
            } catch (error: any) {
                errors++;
                entries.push({
                    itemId: String(item._id),
                    username,
                    storedArtist: album.artist,
                    storedAlbum: album.title,
                    storedYear: album.year,
                    storedFormat,
                    discogsId: album.discogsId,
                    detectedDiscogsFormat: 'Unknown',
                    discogsFormats: [],
                    status: 'error',
                    reason: error.message || 'Unknown error'
                });
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(REPORTS_DIR, `format-verification-${timestamp}.json`);
        const report = {
            generatedAt: new Date().toISOString(),
            summary: {
                total: items.length,
                matches,
                mismatches,
                unknown,
                errors
            },
            mismatches: entries.filter(entry => entry.status === 'mismatch'),
            unknown: entries.filter(entry => entry.status === 'unknown'),
            errors: entries.filter(entry => entry.status === 'error'),
            all: entries
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        console.log('\nFormat verification complete');
        console.log(`Matches: ${matches}`);
        console.log(`Mismatches: ${mismatches}`);
        console.log(`Unknown: ${unknown}`);
        console.log(`Errors: ${errors}`);
        console.log(`Report saved to: ${reportPath}`);
    } finally {
        await mongoose.disconnect();
    }
}

run().catch(error => {
    console.error('Format verification failed:', error);
    process.exit(1);
});
