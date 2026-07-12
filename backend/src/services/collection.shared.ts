/**
 * Collection Shared Helpers
 *
 * Reusable utility functions for extracting data from user collections.
 * Designed to be shared across features (shows, upcoming releases, etc.).
 */

import CollectionItem from '../models/CollectionItem';
import type { IAlbum } from '../models/Album';

export interface WeightedArtist {
  name: string;
  count: number;
}

/**
 * Get all unique artists from a specific user's collection,
 * sorted by number of albums owned (descending).
 */
export async function getUserUniqueArtistsWeighted(userId: string): Promise<WeightedArtist[]> {
  const items = await CollectionItem.find({ user: userId })
    .populate<{ album: IAlbum }>('album')
    .lean();

  const artistCounts = new Map<string, number>();

  for (const item of items) {
    if (!item.album?.artist) continue;
    // Strip Discogs artist suffix (e.g., " (2)") for clean matching
    const cleanName = item.album.artist.replace(/\s\(\d+\)$/, '').trim();
    if (!cleanName) continue;
    artistCounts.set(cleanName, (artistCounts.get(cleanName) || 0) + 1);
  }

  return Array.from(artistCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get all unique artist names from a specific user's collection (simple list).
 */
export async function getUserUniqueArtists(userId: string): Promise<string[]> {
  const weighted = await getUserUniqueArtistsWeighted(userId);
  return weighted.map(a => a.name);
}

/**
 * Get all unique artist names across all users in the database.
 * Used by the admin task to refresh the global shows cache.
 */
export async function getAllUniqueArtists(): Promise<string[]> {
  const items = await CollectionItem.find({})
    .populate<{ album: IAlbum }>('album')
    .lean();

  const artists = new Set<string>();

  for (const item of items) {
    if (!item.album?.artist) continue;
    const cleanName = item.album.artist.replace(/\s\(\d+\)$/, '').trim();
    if (cleanName) {
      artists.add(cleanName);
    }
  }

  return Array.from(artists);
}
