import CollectionItem from '../models/CollectionItem';
import CustomFieldDefinition from '../models/CustomFieldDefinition';
import { IAlbum } from '../models/Album';

// Headers are kept compatible with the import parser so an export can be
// re-imported as-is (see normalizeHeader in import.service).
const BASE_HEADERS = [
    'Artist',
    'Album',
    'Format',
    'Year',
    'Release ID',
    'Catalog Number',
    'Media Condition',
    'Sleeve Condition',
    'Added At'
];

function escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function toCsvLine(values: unknown[]): string {
    return values.map(escapeCsvValue).join(',');
}

/**
 * Build a CSV backup of a user's collection.
 * Custom field values are appended as extra columns: the importer ignores
 * unknown headers, so they are a backup only and are not restored on import.
 */
export async function buildCollectionCsv(userId: any): Promise<string> {
    const [items, customFields] = await Promise.all([
        CollectionItem.find({ user: userId })
            .populate<{ album: IAlbum }>('album')
            .sort({ addedAt: -1 })
            .exec(),
        CustomFieldDefinition.find({ user: userId }).sort({ order: 1 }).exec()
    ]);

    const headers = [...BASE_HEADERS, ...customFields.map(f => f.name)];
    const lines = [toCsvLine(headers)];

    for (const item of items) {
        const album = item.album;
        if (!album) continue;

        // Discogs release ids are on the album; manual entries have none.
        const catalogNumber = album.labels?.find(l => l.catno)?.catno || '';

        const values: unknown[] = [
            album.artist,
            album.title,
            item.format?.name || '',
            album.year || '',
            album.discogsId || '',
            catalogNumber,
            item.mediaCondition || '',
            item.sleeveCondition || '',
            item.addedAt ? item.addedAt.toISOString() : ''
        ];

        for (const field of customFields) {
            // Values are stored keyed by definition id, not by name.
            values.push(item.customFields?.get(String(field._id)) || '');
        }

        lines.push(toCsvLine(values));
    }

    return lines.join('\n');
}

export const csvExportService = {
    buildCollectionCsv
};
