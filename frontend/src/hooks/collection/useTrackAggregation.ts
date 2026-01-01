import { useMemo } from 'react';
import type { CollectionItem } from '../../types/collection';

export interface AlbumReference {
    collectionItemId: string;
    albumId: string;
    title: string;
    artist: string;
    year: string;
    cover_image: string;
    thumb: string;
}

export interface AggregatedTrack {
    id: string;
    title: string;
    artist: string;
    albumCount: number;
    albums: AlbumReference[];
}

export function useTrackAggregation(collection: CollectionItem[]): AggregatedTrack[] {
    return useMemo(() => {
        const trackMap = new Map<string, AggregatedTrack>();

        for (const item of collection) {
            const album = item.album;
            if (!album?.tracklist || album.tracklist.length === 0) continue;

            for (const track of album.tracklist) {
                if (!track.title || track.title.trim() === '') continue;

                // Use track artist if available, otherwise fall back to album artist
                const trackArtist = track.artist?.trim() || album.artist;
                const normalizedTitle = track.title.trim().toLowerCase();
                const normalizedArtist = trackArtist.toLowerCase();
                const key = `${normalizedTitle}---${normalizedArtist}`;

                const albumRef: AlbumReference = {
                    collectionItemId: item._id,
                    albumId: album._id,
                    title: album.title,
                    artist: album.artist,
                    year: album.year,
                    cover_image: album.cover_image,
                    thumb: album.thumb,
                };

                if (trackMap.has(key)) {
                    const existing = trackMap.get(key)!;
                    // Check if album is already in the list (avoid duplicates for same album different formats)
                    const alreadyHasAlbum = existing.albums.some(
                        (a) => a.albumId === album._id
                    );
                    if (!alreadyHasAlbum) {
                        existing.albums.push(albumRef);
                        existing.albumCount = existing.albums.length;
                    }
                } else {
                    trackMap.set(key, {
                        id: key,
                        title: track.title.trim(),
                        artist: trackArtist,
                        albumCount: 1,
                        albums: [albumRef],
                    });
                }
            }
        }

        // Convert to array and sort by title, then artist
        const aggregatedTracks = Array.from(trackMap.values());
        aggregatedTracks.sort((a, b) => {
            const titleCompare = a.title.localeCompare(b.title);
            if (titleCompare !== 0) return titleCompare;
            return a.artist.localeCompare(b.artist);
        });

        return aggregatedTracks;
    }, [collection]);
}
