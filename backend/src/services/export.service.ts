import CollectionItem from '../models/CollectionItem';
import { IAlbum } from '../models/Album';
import { loadCustomFieldsWithUuids } from './customFields.service';
import { formatCustomFieldHeader } from '../utils/customFields.utils';

// Headers are kept compatible with the import parser so an export can be
// re-imported as-is (see normalizeHeader in import.service).
const BASE_HEADERS = [
    'Artist',
    'Album',
    'Format',
    'Year',
    'Release ID',
    'Catalog Number',
    'Label',
    'Genres',
    'Value',
    'Tracklist',
    'Manual',
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
 * Custom field values are appended as extra columns named after the field.
 * Newer headers also carry the field's hidden uuid, so an import restores the
 * values even when the field has been renamed since the export. Unknown custom
 * fields are ignored by the importer.
 */
export async function buildCollectionCsv(userId: any): Promise<string> {
    const [items, customFields] = await Promise.all([
        CollectionItem.find({ user: userId })
            .populate<{ album: IAlbum }>('album')
            .sort({ addedAt: -1 })
            .exec(),
        loadCustomFieldsWithUuids(userId)
    ]);

    const headers = [...BASE_HEADERS, ...customFields.map(f => formatCustomFieldHeader(f.name, f.uuid))];
    const lines = [toCsvLine(headers)];

    for (const item of items) {
        const album = item.album;
        if (!album) continue;

        // Discogs release ids are on the album; manual entries have none.
        const catalogNumber = album.labels?.find(l => l.catno)?.catno || '';
        const labelName = album.labels?.[0]?.name || '';

        const values: unknown[] = [
            album.artist,
            album.title,
            item.format?.name || '',
            album.year || '',
            album.discogsId || '',
            catalogNumber,
            labelName,
            album.styles?.join(', ') || '',
            item.manualValue ?? '',
            album.tracklist?.length ? JSON.stringify(album.tracklist) : '',
            album.isManual ? 'true' : 'false',
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
