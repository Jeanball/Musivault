import mongoose from 'mongoose';
import CollectionItem from '../models/CollectionItem';
import type { IAlbum } from '../models/Album';

/**
 * Get the sorted list of unique album styles present in a single user's collection.
 */
export async function getUserStyles(userId: mongoose.Types.ObjectId | string): Promise<string[]> {
  const collectionItems = await CollectionItem.find({ user: userId }).populate<{ album: IAlbum }>('album');

  const stylesSet = new Set<string>();
  for (const item of collectionItems) {
    if (item.album && item.album.styles) {
      for (const style of item.album.styles) {
        stylesSet.add(style);
      }
    }
  }

  return Array.from(stylesSet).sort();
}

/**
 * Get the sorted list of unique album styles present across every user's collection.
 * Used to build the set of styles worth querying upstream for upcoming releases.
 */
export async function getAllDistinctStyles(): Promise<string[]> {
  const result = await CollectionItem.aggregate<{ _id: string }>([
    {
      $lookup: {
        from: 'albums',
        localField: 'album',
        foreignField: '_id',
        as: 'albumDoc',
      },
    },
    { $unwind: '$albumDoc' },
    { $unwind: '$albumDoc.styles' },
    { $group: { _id: '$albumDoc.styles' } },
    { $sort: { _id: 1 } },
  ]);

  return result.map((r) => r._id);
}
