import { useMemo } from 'react';
import type { CollectionItem, Label } from '../../types/collection.types';
import { stripDiscogsSuffix } from '../../utils/formatters';

export interface LabelRelease {
    collectionItemId: string;
    title: string;
    artist: string;
    year: string;
    cover_image: string;
    thumb: string;
    /** Catalogue number as printed on this particular release. */
    catno: string;
}

export interface AggregatedLabel {
    /** Lowercased name — the grouping key, so casing differences don't split a label. */
    id: string;
    name: string;
    /** Kept for LabelModal, which resolves the official site from the Discogs id. */
    label: Label;
    releaseCount: number;
    releases: LabelRelease[];
}

/**
 * Groups the collection by record label.
 *
 * A release can be co-issued, so it legitimately counts under several labels and
 * the counts here sum past the collection size.
 */
export function useLabelAggregation(collection: CollectionItem[]): AggregatedLabel[] {
    return useMemo(() => {
        const labelMap = new Map<string, AggregatedLabel>();

        for (const item of collection) {
            const album = item.album;
            if (!album?.labels || album.labels.length === 0) continue;

            for (const label of album.labels) {
                // Stripped before grouping, not just for display: Discogs writes
                // "Columbia (2)" when a name collides, and leaving it would split
                // one imprint into two entries.
                const name = stripDiscogsSuffix(label.name?.trim() || '');
                if (!name) continue;

                const key = name.toLowerCase();
                let entry = labelMap.get(key);
                if (!entry) {
                    // Keep the Discogs id — LabelModal resolves the official site
                    // from it — but carry the cleaned name for display.
                    entry = { id: key, name, label: { ...label, name }, releaseCount: 0, releases: [] };
                    labelMap.set(key, entry);
                }

                // The same release listing a label twice must not count twice.
                if (entry.releases.some((r) => r.collectionItemId === item._id)) continue;

                entry.releases.push({
                    collectionItemId: item._id,
                    title: album.title,
                    artist: album.artist,
                    year: album.year,
                    cover_image: album.cover_image,
                    thumb: album.thumb,
                    catno: label.catno || '',
                });
                entry.releaseCount += 1;
            }
        }

        return Array.from(labelMap.values())
            .map((entry) => ({
                ...entry,
                releases: entry.releases.sort((a, b) => a.artist.localeCompare(b.artist)),
            }))
            .sort((a, b) => b.releaseCount - a.releaseCount || a.name.localeCompare(b.name));
    }, [collection]);
}
