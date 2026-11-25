import { describe, expect, it } from 'vitest';
import {
    applyAlbumOverrides,
    applyAlbumOverridesToAll,
    buildAlbumOverrides,
    hasAlbumOverrides,
    mergeAlbumOverrides,
    toPlainAlbum
} from './albumOverrides.utils';

const baseAlbum = {
    _id: 'album-1',
    discogsId: 123,
    isManual: false,
    title: 'Kind of Blue',
    artist: 'Miles Davis',
    year: '1959',
    thumb: '/uploads/covers/discogs.jpg',
    cover_image: '/uploads/covers/discogs.jpg',
    styles: ['Jazz', 'Modal'],
    genres: ['Jazz'],
    tracklist: [
        { position: 'A1', title: 'So What', duration: '9:22', artist: '' },
        { position: 'A2', title: 'Freddie Freeloader', duration: '9:46', artist: '' }
    ],
    labels: [{ name: 'Columbia', catno: 'CL 1355', discogsId: 999 }]
};

describe('albumOverrides.utils', () => {
    it('detects whether there is anything to apply', () => {
        expect(hasAlbumOverrides(null)).toBe(false);
        expect(hasAlbumOverrides(undefined)).toBe(false);
        expect(hasAlbumOverrides({})).toBe(false);
        expect(hasAlbumOverrides({ title: 'Edited' })).toBe(true);
        expect(hasAlbumOverrides({ cover_image: '/uploads/covers/new.jpg' })).toBe(true);
    });

    it('lays the edits over the album without mutating it', () => {
        const merged = mergeAlbumOverrides(baseAlbum, {
            title: 'Kind of Blue (Mono)',
            genres: ['Jazz', 'Blues'],
            styles: ['Jazz']
        });

        expect(merged.title).toBe('Kind of Blue (Mono)');
        expect(merged.genres).toEqual(['Jazz', 'Blues']);
        expect(merged.styles).toEqual(['Jazz']);
        expect(merged.artist).toBe('Miles Davis');
        expect(baseAlbum.title).toBe('Kind of Blue');
        expect(merged).not.toBe(baseAlbum);
    });

    it('stores only the fields that differ from the shared album', () => {
        const overrides = buildAlbumOverrides(baseAlbum, null, {
            title: 'Kind of Blue',
            artist: 'Miles Davis',
            year: '1958',
            genres: ['Jazz'],
            styles: ['Jazz', 'Modal'],
            tracklist: baseAlbum.tracklist,
            labels: [{ name: 'Columbia', catno: 'CL 1355' }],
            cover_image: '/uploads/covers/discogs.jpg'
        });

        expect(overrides).toEqual({ year: '1958' });
    });

    it('keeps an edit that differs and drops one that goes back to the original', () => {
        const edited = buildAlbumOverrides(baseAlbum, null, { title: 'Blue', cover_image: '/uploads/covers/mine.jpg' });
        expect(edited).toEqual({
            title: 'Blue',
            cover_image: '/uploads/covers/mine.jpg',
            thumb: '/uploads/covers/mine.jpg'
        });

        const restored = buildAlbumOverrides(baseAlbum, edited, { title: 'Kind of Blue' });
        expect(restored).toEqual({
            cover_image: '/uploads/covers/mine.jpg',
            thumb: '/uploads/covers/mine.jpg'
        });
    });

    it('stores a changed genre separately from the styles', () => {
        const overrides = buildAlbumOverrides(baseAlbum, null, {
            genres: ['Jazz', 'Blues'],
            styles: ['Jazz', 'Modal']
        });

        expect(overrides).toEqual({ genres: ['Jazz', 'Blues'] });
    });

    it('returns null when nothing is left to override', () => {
        expect(buildAlbumOverrides(baseAlbum, { year: '1958' }, { year: '1959' })).toBeNull();
        expect(buildAlbumOverrides(baseAlbum, null, {})).toBeNull();
    });

    it('compares labels and tracks ignoring internal ids and missing fields', () => {
        const overrides = buildAlbumOverrides(baseAlbum, null, {
            labels: [{ name: 'Columbia', catno: 'CL 1355' }],
            tracklist: [
                { position: 'A1', title: 'So What', duration: '9:22' },
                { position: 'A2', title: 'Freddie Freeloader', duration: '9:46' }
            ]
        });

        expect(overrides).toBeNull();
    });

    it('ignores whitespace-only differences in text fields', () => {
        const overrides = buildAlbumOverrides(
            { ...baseAlbum, title: 'Kind of Blue  ', artist: ' Miles Davis' },
            null,
            { title: 'Kind of Blue', artist: 'Miles Davis' }
        );

        expect(overrides).toBeNull();
    });

    it('treats the Discogs "none" catalog number as blank when comparing labels', () => {
        const overrides = buildAlbumOverrides(
            { ...baseAlbum, labels: [{ name: 'Columbia', catno: 'none', discogsId: 999 }] },
            null,
            { labels: [{ name: 'Columbia', catno: '' }] }
        );

        expect(overrides).toBeNull();
    });

    it('applies the edits to a plain collection item', () => {
        const item = { _id: 'item-1', album: baseAlbum, albumOverrides: { year: '1958' } };
        const applied = applyAlbumOverrides(item);

        expect(applied.album.year).toBe('1958');
        expect(applied.album.title).toBe('Kind of Blue');
        // The shared album object is copied, not edited in place.
        expect((item.album as { year?: string }).year).toBe('1959');
    });

    it('works on lean results and leaves untouched items as they are', () => {
        const untouched = { _id: 'item-1', album: baseAlbum };
        expect(applyAlbumOverrides(untouched)).toBe(untouched);

        const leanAlbum = { artist: 'A', title: 'T' };
        expect(toPlainAlbum(leanAlbum)).toBe(leanAlbum);

        const document = { toObject: () => ({ ...baseAlbum }) };
        expect(toPlainAlbum(document as never)).toEqual(baseAlbum);
    });

    it('applies overrides stored as a Mongoose subdocument', () => {
        const overridesDoc = {
            title: 'Stored title',
            year: '1958',
            toObject: () => ({ title: 'Stored title', year: '1958' })
        };

        const merged = mergeAlbumOverrides(baseAlbum, overridesDoc);
        expect(merged.title).toBe('Stored title');
        expect(merged.year).toBe('1958');

        const applied = applyAlbumOverrides({ album: baseAlbum, albumOverrides: overridesDoc });
        expect(applied.album.title).toBe('Stored title');
        expect(applied.album.year).toBe('1958');
        expect(applied.album.artist).toBe('Miles Davis');
    });

    it('serializes custom field Maps as plain objects in the response copy', () => {
        const document = {
            album: baseAlbum,
            albumOverrides: { year: '1958' },
            customFields: new Map([['field-binder', 'Shelf A']]),
            toObject: () => ({
                album: baseAlbum,
                albumOverrides: { year: '1958' },
                customFields: new Map([['field-binder', 'Shelf A']])
            })
        };

        const applied = applyAlbumOverrides(document);

        expect(applied.customFields).toEqual({ 'field-binder': 'Shelf A' });
        expect(JSON.stringify(applied)).toContain('"customFields":{"field-binder":"Shelf A"}');
        expect(document.customFields).toBeInstanceOf(Map);
    });

    it('applies the edits to every item in a list', () => {
        const items = [
            { _id: 'a', album: { ...baseAlbum }, albumOverrides: { title: 'One' } },
            { _id: 'b', album: { ...baseAlbum }, albumOverrides: null }
        ];

        const applied = applyAlbumOverridesToAll(items);

        expect(applied[0].album.title).toBe('One');
        expect(applied[1].album.title).toBe('Kind of Blue');
    });
});
