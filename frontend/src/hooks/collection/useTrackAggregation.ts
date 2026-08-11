import { useMemo } from 'react';
import type { CollectionItem } from '../../types/collection.types';

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

/**
 * Marks a different master of the same performance. Owning the original press
 * and a reissue is the ordinary way a collection ends up with both.
 */
const SAME_RECORDING = /\b(re-?master(ed)?|reissue|remastered|mono|stereo|original\s+recording|\d{4}\s+remaster)\b/i;

/**
 * Marks a different performance or arrangement. These stay apart even when a
 * reissue word sits beside them: a live take is not the studio cut.
 */
const DIFFERENT_TAKE = /\b(live|demo|acoustic|instrumental|a\s?capella|radio|single|extended|remix|rehearsal|session|alternate|take|edit|dub|karaoke)\b/i;

/**
 * Grouping key for a title.
 *
 * Two things are folded away. Punctuation, because pressings of one record
 * differ by nothing more than a trailing mark and Discogs carries that
 * verbatim ("If Looks Could Kill" and "If Looks Could Kill..."). And the
 * qualifier a reissue appends, so a 2011 remaster meets the pressing it was
 * made from.
 *
 * Only qualifiers naming a master are dropped. Anything naming another
 * performance is kept, which is what stops a live version from swallowing the
 * studio one: inventing a duplicate is worse than missing one.
 */
const normalizeTitle = (title: string): string => {
    const qualifier = /\s*[([][^)\]]*[)\]]\s*$|\s+-\s+[^-]+$/;

    let stripped = title;
    // Loop: "Song (Live) (2011 Remaster)" must lose only the second group.
    for (let pass = 0; pass < 3; pass++) {
        const match = stripped.match(qualifier);
        if (!match) break;
        if (!SAME_RECORDING.test(match[0]) || DIFFERENT_TAKE.test(match[0])) break;
        stripped = stripped.slice(0, match.index).trim();
    }

    return stripped.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() || title.toLowerCase().trim();
};

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
                const normalizedTitle = normalizeTitle(track.title);
                const normalizedArtist = trackArtist.toLowerCase().trim();
                if (!normalizedTitle) continue;
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
