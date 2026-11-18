import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/CollectionItem', () => ({ default: { find: vi.fn() } }));
vi.mock('../models/CustomFieldDefinition', () => ({ default: { find: vi.fn() } }));
vi.mock('../utils/cover.utils', () => ({ localCoverToDataUri: vi.fn() }));

import CollectionItem from '../models/CollectionItem';
import CustomFieldDefinition from '../models/CustomFieldDefinition';
import { localCoverToDataUri } from '../utils/cover.utils';
import { buildCollectionCsv } from './export.service';

function chain<T>(value: T) {
    return {
        populate: () => chain(value),
        select: () => chain(value),
        sort: () => chain(value),
        exec: async () => value
    };
}

describe('buildCollectionCsv', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(localCoverToDataUri).mockResolvedValue(null);
    });

    it('exports the manual fields and custom-field columns', async () => {
        const item = {
            format: { name: 'Cassette' },
            manualValue: 12.5,
            mediaCondition: 'NM',
            sleeveCondition: 'VG+',
            addedAt: new Date('2020-01-02T03:04:05.000Z'),
            customFields: new Map([['field-1', 'Signed']]),
            album: {
                artist: 'Local Band',
                title: 'Live, at Home',
                year: '2020',
                labels: [{ name: 'Self-released', catno: 'LB-1' }],
                styles: ['Rock', 'Live'],
                genres: ['Rock'],
                tracklist: [{ position: 'A1', title: 'Intro', duration: '3:20', artist: '' }],
                isManual: true
            }
        };

        vi.mocked(CollectionItem.find).mockReturnValue(chain([item]) as never);
        vi.mocked(CustomFieldDefinition.find).mockReturnValue(
            chain([{ _id: 'field-1', name: 'Custom Note', uuid: '11111111-1111-4111-8111-111111111111' }]) as never
        );

        const csv = await buildCollectionCsv('user-1');
        const [header, row] = csv.split('\n');

        expect(header).toBe(
            'Artist,Album,Format,Year,Release ID,Catalog Number,Label,Genres,Discogs Genres,Value,Tracklist,Manual,Media Condition,Sleeve Condition,Added At,Cover Base64,Custom Note [cf:11111111-1111-4111-8111-111111111111]'
        );
        expect(row).toContain('Local Band');
        expect(row).toContain('"Live, at Home"');
        expect(row).toContain('Cassette');
        expect(row).toContain('LB-1');
        expect(row).toContain('Self-released');
        expect(row).toContain('"Rock, Live"');
        // The Discogs genres sit in their own column, right after the styles.
        expect(row).toContain('"Rock, Live",Rock,12.5');
        expect(row).toContain('12.5');
        expect(row).toContain('true');
        expect(row).toContain('NM');
        expect(row).toContain('VG+');
        expect(row).toContain('2020-01-02T03:04:05.000Z');
        expect(row).toContain('Signed');
        // The cover column stays empty when no local image exists.
        expect(row).toContain('2020-01-02T03:04:05.000Z,,Signed');
    });

    it('embeds a locally stored cover as a base64 data URI', async () => {
        const item = {
            format: { name: 'Vinyl' },
            addedAt: new Date('2020-01-02T03:04:05.000Z'),
            album: {
                artist: 'Local Band',
                title: 'Live at Home',
                cover_image: '/uploads/covers/123-456.jpg',
                isManual: true
            }
        };

        vi.mocked(CollectionItem.find).mockReturnValue(chain([item]) as never);
        vi.mocked(CustomFieldDefinition.find).mockReturnValue(chain([]) as never);
        vi.mocked(localCoverToDataUri).mockResolvedValue('data:image/jpeg;base64,QUJD');

        const csv = await buildCollectionCsv('user-1');
        const [header, row] = csv.split('\n');

        expect(header).toMatch(/,Cover Base64$/);
        expect(row).toContain('"data:image/jpeg;base64,QUJD"');
        expect(localCoverToDataUri).toHaveBeenCalledWith('/uploads/covers/123-456.jpg');
    });
});
