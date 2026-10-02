import mongoose from 'mongoose';
import { Request, Response } from 'express';
import User from '../models/User';
import CollectionItem from '../models/CollectionItem';
import { IAlbum } from '../models/Album';
import { logger } from '../config/logger.config';

export async function getPublicCollection(req: Request, res: Response) {
    try {
        const { shareId } = req.params;

        // Find user by publicShareId
        const user = await User.findOne({ publicShareId: shareId });

        if (!user) {
            res.status(404).json({ message: 'Collection not found' });
            return;
        }

        // Check if collection is public
        if (!user.preferences?.isPublic) {
            res.status(404).json({ message: 'Collection not found' });
            return;
        }

        // customFields and formatVerification are private housekeeping, never exposed publicly
        const collection = await CollectionItem.find({ user: user._id })
            .select('-customFields -formatVerification')
            .populate<{ album: IAlbum }>('album');

        // Sort by artist
        collection.sort((a, b) => {
            if (a.album && b.album) {
                return a.album.artist.localeCompare(b.album.artist);
            }
            return 0;
        });

        res.status(200).json({
            username: user.username,
            collection: collection,
            total: collection.length
        });
    } catch (error) {
        logger.error({ err: error }, 'Error fetching public collection');
        res.status(500).json({ message: 'Internal server error' });
    }
}

/** How many recent additions each public collection shows on its card. */
const LATEST_PER_USER = 6;

export async function getPublicUsers(req: Request, res: Response) {
    try {
        // Find all users with public collections
        const publicUsers = await User.find({ 'preferences.isPublic': true })
            .select('username publicShareId createdAt')
            .lean();

        // Counts and latest additions for every public user in one pass. Doing this
        // per user meant two round trips each, which is what would have buckled
        // first as an instance grows.
        const stats = await CollectionItem.aggregate<{
            _id: mongoose.Types.ObjectId;
            albumCount: number;
            latestAlbums: unknown[];
        }>([
            { $match: { user: { $in: publicUsers.map((u) => u._id) } } },
            { $sort: { user: 1, addedAt: -1 } },
            {
                $group: {
                    _id: '$user',
                    albumCount: { $sum: 1 },
                    latestAlbums: { $push: '$$ROOT' },
                },
            },
            { $project: { albumCount: 1, latestAlbums: { $slice: ['$latestAlbums', LATEST_PER_USER] } } },
            // Private housekeeping, never leaves the server.
            { $unset: ['latestAlbums.customFields', 'latestAlbums.formatVerification'] },
        ]);

        await CollectionItem.populate(stats, { path: 'latestAlbums.album', model: 'Album' });

        const statsByUser = new Map(stats.map((s) => [String(s._id), s]));

        const usersWithCounts = publicUsers.map((user) => {
            const stat = statsByUser.get(String(user._id));
            return {
                username: user.username,
                publicShareId: user.publicShareId,
                albumCount: stat?.albumCount ?? 0,
                createdAt: user.createdAt,
                latestAlbums: stat?.latestAlbums ?? [],
            };
        });

        // Sort by album count (most albums first)
        usersWithCounts.sort((a, b) => b.albumCount - a.albumCount);

        res.status(200).json(usersWithCounts);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching public users');
        res.status(500).json({ message: 'Internal server error' });
    }
}

const DEFAULT_LATEST_ALBUMS = 6;
const MAX_LATEST_ALBUMS = 24;

export async function getLatestPublicAlbums(req: Request, res: Response) {
    try {
        // Never the caller's raw number: this bounds a query.
        const requested = parseInt(String(req.query.limit), 10);
        const limit = Number.isNaN(requested)
            ? DEFAULT_LATEST_ALBUMS
            : Math.min(Math.max(requested, 1), MAX_LATEST_ALBUMS);

        // Find all users with public collections
        const publicUsers = await User.find({ 'preferences.isPublic': true }).select('_id').lean();
        const publicUserIds = publicUsers.map(u => u._id);

        // customFields and formatVerification are private housekeeping, never exposed publicly
        const latestItems = await CollectionItem.find({ user: { $in: publicUserIds } })
            .select('-customFields -formatVerification')
            .sort({ addedAt: -1 })
            .limit(limit)
            .populate<{ album: IAlbum }>('album')
            .populate('user', 'username publicShareId');

        // An item whose album was deleted populates to null and would render as an
        // empty tile — drop it rather than ship a hole in the row.
        res.status(200).json(latestItems.filter((item) => item.album));
    } catch (error) {
        logger.error({ err: error }, 'Error fetching latest public albums');
        res.status(500).json({ message: 'Internal server error' });
    }
}
