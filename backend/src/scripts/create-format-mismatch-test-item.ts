import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import path from 'path';
import User from '../models/User';
import Album from '../models/Album';
import CollectionItem from '../models/CollectionItem';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DISCOGS_SECRET = process.env.DISCOGS_SECRET;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/musivault';
const RATE_LIMIT_DELAY_MS = 2500;

interface DiscogsRelease {
    id: number;
    title: string;
    formats?: { name?: string; descriptions?: string[] }[];
}

function getArg(flag: string): string | undefined {
    const prefix = `--${flag}=`;
    return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function detectDiscogsFormat(formats?: { name?: string; descriptions?: string[] }[]): 'Vinyl' | 'CD' | 'Cassette' | 'Unknown' {
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

function getMismatchedFormat(detectedFormat: 'Vinyl' | 'CD' | 'Cassette' | 'Unknown'): 'Vinyl' | 'CD' | 'Cassette' {
    switch (detectedFormat) {
        case 'Vinyl':
            return 'CD';
        case 'CD':
            return 'Vinyl';
        case 'Cassette':
            return 'Vinyl';
        default:
            return 'CD';
    }
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

async function pickUser() {
    const userSelector = getArg('user');

    if (userSelector) {
        const user = await User.findOne({
            $or: [
                { username: userSelector },
                { email: userSelector }
            ]
        });

        if (!user) {
            throw new Error(`No user found for "${userSelector}"`);
        }

        return user;
    }

    const user = await User.findOne({}).sort({ createdAt: 1 });
    if (!user) {
        throw new Error('No users found in the database');
    }

    return user;
}

async function pickAlbum() {
    const discogsIdArg = getArg('discogsId');

    if (discogsIdArg) {
        const discogsId = Number.parseInt(discogsIdArg, 10);
        if (Number.isNaN(discogsId)) {
            throw new Error(`Invalid discogsId "${discogsIdArg}"`);
        }

        const album = await Album.findOne({ discogsId });
        if (!album) {
            throw new Error(`No album found in MongoDB for Discogs release ${discogsId}`);
        }

        return album;
    }

    const album = await Album.findOne({
        discogsId: { $exists: true, $ne: null }
    }).sort({ _id: 1 });

    if (!album?.discogsId) {
        throw new Error('No Discogs-linked album found in the database');
    }

    return album;
}

async function run() {
    await mongoose.connect(MONGO_URI);

    try {
        const user = await pickUser();
        const album = await pickAlbum();

        if (!album.discogsId) {
            throw new Error('Selected album does not have a Discogs release ID');
        }

        console.log(`Using user: ${user.username} (${user.email})`);
        console.log(`Using album: ${album.artist} - ${album.title} [Discogs ${album.discogsId}]`);

        const release = await fetchDiscogsRelease(album.discogsId);
        const detectedDiscogsFormat = detectDiscogsFormat(release.formats);

        if (detectedDiscogsFormat === 'Unknown') {
            throw new Error(`Could not classify Discogs format for release ${release.id}`);
        }

        const mismatchedFormat = getMismatchedFormat(detectedDiscogsFormat);

        const existingItem = await CollectionItem.findOne({
            user: user._id,
            album: album._id,
            'format.name': mismatchedFormat,
            'format.text': 'Mismatch Test Item'
        }).populate('album');

        if (existingItem) {
            console.log('A matching test item already exists.');
            console.log(`Item ID: ${existingItem._id}`);
            console.log(`Stored format: ${existingItem.format.name}`);
            console.log(`Detected Discogs format: ${detectedDiscogsFormat}`);
            return;
        }

        const newItem = await CollectionItem.create({
            user: user._id,
            album: album._id,
            format: {
                name: mismatchedFormat,
                descriptions: [],
                text: 'Mismatch Test Item'
            },
            formatVerification: {
                status: 'mismatch',
                reasonCode: 'format_mismatch',
                detectedDiscogsFormat,
                checkedAt: new Date(),
                ignoredAt: null
            }
        });

        console.log('Created mismatch test item successfully.');
        console.log(`Item ID: ${newItem._id}`);
        console.log(`Stored format: ${mismatchedFormat}`);
        console.log(`Detected Discogs format: ${detectedDiscogsFormat}`);
        console.log('You can open this item in the collection UI to test Rematch and Ignore alert.');
    } finally {
        await mongoose.disconnect();
    }
}

run().catch(error => {
    console.error('Failed to create mismatch test item:', error);
    process.exit(1);
});
