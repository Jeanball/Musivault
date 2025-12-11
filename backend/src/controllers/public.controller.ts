import { Request, Response } from 'express';
import User from '../models/User';
import CollectionItem from '../models/CollectionItem';
import { IAlbum } from '../models/Album';

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

        // Fetch collection items for this user
        const collection = await CollectionItem.find({ user: user._id })
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
        console.error('Error fetching public collection:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}
