import mongoose from 'mongoose';
import CollectionItem from '../models/CollectionItem';
import User from '../models/User';
import type { IAlbum } from '../models/Album';
import { normalizeStyle } from './musicbrainz.service';

/**
 * The styles a member gets recommendations for: collection styles plus the
 * ones they follow, minus the ones they excluded (compared case-insensitively).
 * Keeps the first spelling seen, since Ticketmaster genre mapping matches
 * Discogs spellings; use `toMusicBrainzStyles` for MusicBrainz tags.
 */
export function resolveMemberStyles(
  collectionStyles: string[],
  includedStyles: string[] = [],
  excludedStyles: string[] = []
): string[] {
  const excluded = new Set(excludedStyles.map(normalizeStyle));
  const byKey = new Map<string, string>();
  for (const style of [...collectionStyles, ...includedStyles]) {
    const key = normalizeStyle(style);
    if (key && !excluded.has(key) && !byKey.has(key)) byKey.set(key, style);
  }
  return Array.from(byKey.values()).sort();
}

/** Lowercase and dedupe styles the way `UpcomingRelease.style` stores them (MusicBrainz tags are lowercase). */
export function toMusicBrainzStyles(styles: string[]): string[] {
  return Array.from(new Set(styles.map(normalizeStyle))).sort();
}

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
 * Get the sorted list of unique artists in a single user's collection.
 * Used to spot concerts by acts the user already owns records from.
 */
export async function getUserArtists(userId: mongoose.Types.ObjectId | string): Promise<string[]> {
  const result = await CollectionItem.aggregate<{ _id: string }>([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'albums',
        localField: 'album',
        foreignField: '_id',
        as: 'albumDoc',
      },
    },
    { $unwind: '$albumDoc' },
    { $group: { _id: '$albumDoc.artist' } },
    { $sort: { _id: 1 } },
  ]);

  return result.map((r) => r._id).filter(Boolean);
}

/**
 * Get the sorted list of styles worth querying upstream for upcoming releases:
 * every style at least one member wants, meaning it is in their collection or
 * followed, and not excluded. Exclusions only count per member, so a style one
 * member excluded is still fetched for another who wants it.
 */
export async function getAllDistinctStyles(): Promise<string[]> {
  const [collectionRows, users] = await Promise.all([
    CollectionItem.aggregate<{ _id: mongoose.Types.ObjectId; styles: string[] }>([
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
      { $group: { _id: '$user', styles: { $addToSet: '$albumDoc.styles' } } },
    ]),
    User.find({}, { 'preferences.discoverIncludedStyles': 1, 'preferences.discoverExcludedStyles': 1 }).lean(),
  ]);

  const collectionByUser = new Map(collectionRows.map((r) => [String(r._id), r.styles]));
  const wanted = new Set<string>();
  for (const user of users) {
    const styles = resolveMemberStyles(
      collectionByUser.get(String(user._id)) || [],
      user.preferences?.discoverIncludedStyles,
      user.preferences?.discoverExcludedStyles
    );
    toMusicBrainzStyles(styles).forEach((s) => wanted.add(s));
  }
  return Array.from(wanted).sort();
}
