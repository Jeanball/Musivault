import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../models/Album', () => ({
    default: Object.assign(vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
        Object.assign(this, data, { _id: 'album-1', save: vi.fn() });
    }), { findOne: vi.fn(async () => null) })
}));
vi.mock('../models/CollectionItem', () => ({
    default: Object.assign(vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
        Object.assign(this, data, { save: vi.fn() });
    }), { findOne: vi.fn(async () => null) })
}));
vi.mock('../models/CustomFieldDefinition', () => ({ default: { find: vi.fn(async () => []) } }));
vi.mock('../models/ImportLog', () => ({ default: {} }));
vi.mock('../models/User', () => ({ default: {} }));
vi.mock('./discogs.service', () => ({
    discogsService: { fetchByReleaseId: vi.fn(), searchByArtistAlbum: vi.fn(), searchByCatalogNumber: vi.fn(), getMarketplaceStats: vi.fn() }
}));

import Album from '../models/Album';
import CollectionItem from '../models/CollectionItem';
import { discogsService } from './discogs.service';
import { parseCsvBuffer, processImportRow } from './import.service';

describe('CSV fields', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses label, genres, value, tracklist, manual flag and custom columns', async () => {
        const buffer = Buffer.from([
            'Artist,Album,Format,Year,Release ID,Catalog Number,Label,Genres,Value,Tracklist,Manual,Media Condition,Sleeve Condition,Added At,Custom Note',
            'Local Band,Live at Home,Cassette,2020,,,Self-released,"Rock, Live",12.5,"[{""position"":""A1"",""title"":""Intro"",""duration"":""3:20"",""artist"":""""}]",true,,,2020-01-02T03:04:05.000Z,Signed'
        ].join('\n'));

        const [row] = await parseCsvBuffer(buffer);

        expect(row.format).toBeUndefined();
        expect(row.formatName).toBe('Cassette');
        expect(row.label).toBe('Self-released');
        expect(row.genres).toEqual(['Rock', 'Live']);
        expect(row.value).toBe(12.5);
        expect(row.tracklist).toEqual([{ position: 'A1', title: 'Intro', duration: '3:20', artist: '' }]);
        expect(row.manual).toBe(true);
        expect(row.addedAt?.toISOString()).toBe('2020-01-02T03:04:05.000Z');
        expect(row.customFieldColumns).toEqual([{ name: 'custom note', value: 'Signed' }]);
    });

    it('ignores the UTF-8 BOM that exported files start with', async () => {
        const [row] = await parseCsvBuffer(Buffer.from('\uFEFFArtist,Album,Format\nA,T,Vinyl'));

        expect(row.artist).toBe('A');
        expect(row.album).toBe('T');
        expect(row.format).toBe('Vinyl');
    });

    it('rebuilds a manual album and restores known custom fields, ignoring unknown ones', async () => {
        const result = await processImportRow(
            {
                artist: 'Local Band',
                album: 'Live at Home',
                formatName: 'Cassette',
                year: '2020',
                label: 'Self-released',
                genres: ['Rock'],
                tracklist: [{ position: 'A1', title: 'Intro', duration: '3:20', artist: '' }],
                value: 12.5,
                manual: true,
                customFieldColumns: [
                    { name: 'custom note', value: 'Signed' },
                    { name: 'field from another instance', value: 'ignored' }
                ]
            },
            'user-1',
            {
                customFieldDefinitions: {
                    byUuid: new Map(),
                    byName: new Map([['custom note', 'field-1']])
                }
            }
        );

        expect(result.success).toBe(true);
        expect(discogsService.fetchByReleaseId).not.toHaveBeenCalled();
        expect(vi.mocked(Album)).toHaveBeenCalledWith(expect.objectContaining({
            isManual: true,
            title: 'Live at Home',
            artist: 'Local Band',
            year: '2020',
            styles: ['Rock'],
            tracklist: [{ position: 'A1', title: 'Intro', duration: '3:20', artist: '' }],
            labels: [{ name: 'Self-released', catno: '' }]
        }));
        expect(vi.mocked(CollectionItem)).toHaveBeenCalledWith(expect.objectContaining({
            format: expect.objectContaining({ name: 'Cassette' }),
            manualValue: 12.5,
            customFields: { 'field-1': 'Signed' }
        }));
    });

    it('restores custom fields when the row matched a Discogs release', async () => {
        vi.mocked(discogsService.fetchByReleaseId).mockResolvedValue({
            discogsId: 7, title: 'T', artist: 'A', year: '1990', thumb: '', cover_image: '',
            formats: [{ name: 'Vinyl', qty: '1' }]
        });
        vi.mocked(discogsService.getMarketplaceStats).mockResolvedValue(null);

        const result = await processImportRow(
            {
                artist: 'A',
                album: 'T',
                releaseId: '7',
                customFieldColumns: [{ name: 'custom note', value: 'Signed' }]
            },
            'user-1',
            {
                customFieldDefinitions: {
                    byUuid: new Map(),
                    byName: new Map([['custom note', 'field-1']])
                }
            }
        );

        expect(result.success).toBe(true);
        expect(vi.mocked(CollectionItem)).toHaveBeenCalledWith(expect.objectContaining({
            customFields: { 'field-1': 'Signed' }
        }));
    });

    it('finds the field by uuid after it was renamed', async () => {
        const uuid = '2f6c1a5e-9d3b-4f0a-8c7e-123456789abc';
        const buffer = Buffer.from([
            `Artist,Album,Format,Release ID,Old Binder Name [cf:${uuid}]`,
            'A,T,Vinyl,7,Shelf A'
        ].join('\n'));

        const [row] = await parseCsvBuffer(buffer);
        expect(row.customFieldColumns).toEqual([
            { name: 'old binder name', uuid, value: 'Shelf A' }
        ]);

        vi.mocked(discogsService.fetchByReleaseId).mockResolvedValue({
            discogsId: 7, title: 'T', artist: 'A', year: '1990', thumb: '', cover_image: '',
            formats: [{ name: 'Vinyl', qty: '1' }]
        });
        vi.mocked(discogsService.getMarketplaceStats).mockResolvedValue(null);

        const result = await processImportRow(row, 'user-1', {
            customFieldDefinitions: {
                byUuid: new Map([[uuid, 'field-renamed']]),
                byName: new Map([['new binder name', 'field-renamed']])
            }
        });

        expect(result.success).toBe(true);
        expect(vi.mocked(CollectionItem)).toHaveBeenCalledWith(expect.objectContaining({
            customFields: { 'field-renamed': 'Shelf A' }
        }));
    });

    it('falls back to the name when the uuid belongs to another instance', async () => {
        vi.mocked(discogsService.fetchByReleaseId).mockResolvedValue({
            discogsId: 7, title: 'T', artist: 'A', year: '1990', thumb: '', cover_image: '',
            formats: [{ name: 'Vinyl', qty: '1' }]
        });
        vi.mocked(discogsService.getMarketplaceStats).mockResolvedValue(null);

        const result = await processImportRow(
            {
                artist: 'A',
                album: 'T',
                releaseId: '7',
                customFieldColumns: [
                    { name: 'custom note', uuid: 'uuid-from-another-instance', value: 'Signed' }
                ]
            },
            'user-1',
            {
                customFieldDefinitions: {
                    byUuid: new Map(),
                    byName: new Map([['custom note', 'field-1']])
                }
            }
        );

        expect(result.success).toBe(true);
        expect(vi.mocked(CollectionItem)).toHaveBeenCalledWith(expect.objectContaining({
            customFields: { 'field-1': 'Signed' }
        }));
    });
});
