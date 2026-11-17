import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreDiscogsAlbum, updateDiscogsAlbum } from './collection.controller';
import CollectionItem from '../models/CollectionItem';
import { validateCustomFieldValues } from './customFields.controller';

vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../models/Album', () => ({
    default: vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
        Object.assign(this, data, { save: vi.fn().mockResolvedValue(undefined) });
    }),
}));

vi.mock('../models/CollectionItem', () => {
    const findById = vi.fn();
    const findOne = vi.fn();
    const model = vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
        Object.assign(this, data, { save: vi.fn().mockResolvedValue(undefined) });
    });
    Object.assign(model, { findById, findOne });
    return { default: model };
});

vi.mock('./customFields.controller', () => ({
    validateCustomFieldValues: vi.fn(),
}));

const baseAlbum = {
    _id: 'album-1',
    discogsId: 123,
    isManual: false,
    title: 'Kind of Blue',
    artist: 'Miles Davis',
    year: '1959',
    cover_image: '/uploads/covers/discogs.jpg',
    thumb: '/uploads/covers/discogs.jpg',
    styles: ['Jazz', 'Modal'],
    genres: ['Jazz'],
    tracklist: [{ position: 'A1', title: 'So What', duration: '9:22', artist: '' }],
    labels: [{ name: 'Columbia', catno: 'CL 1355', discogsId: 999 }],
};

const createItem = (overrides: Record<string, unknown> = {}) => {
    const data: Record<string, unknown> = {
        title: baseAlbum.title,
        artist: baseAlbum.artist,
        year: baseAlbum.year,
        cover_image: baseAlbum.cover_image,
        thumb: baseAlbum.thumb,
        styles: [...baseAlbum.styles],
        genres: [...baseAlbum.genres],
        tracklist: [...baseAlbum.tracklist],
        labels: [{ ...baseAlbum.labels[0] }],
        ...overrides,
    };
    const album = {
        ...baseAlbum,
        ...overrides,
        save: vi.fn().mockResolvedValue(undefined),
        toObject: () => ({ ...data }),
    };
    return {
        _id: 'item-1',
        album,
        format: { name: 'Vinyl', descriptions: ['LP', 'Album'], text: 'Vinyl LP' },
        mediaCondition: 'VG+',
        sleeveCondition: 'VG',
        formatVerification: {
            status: 'mismatch',
            reasonCode: 'format_mismatch',
            detectedDiscogsFormat: 'CD',
            checkedAt: new Date('2025-01-01T00:00:00.000Z'),
            ignoredAt: null,
        },
        albumOverrides: null,
        locallyModified: false,
        save: vi.fn().mockResolvedValue(undefined),
    };
};

const response = () => {
    const res = {
        status: vi.fn(),
        json: vi.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
};

const request = (itemId: string, body: Record<string, unknown> = {}) =>
    ({ user: { _id: 'user-1' }, params: { itemId }, body } as never);

/** Wire findOne/findById to the same item, like a real round trip. */
const storeItem = (item: ReturnType<typeof createItem>) => {
    vi.mocked(CollectionItem.findOne).mockReturnValue({
        populate: vi.fn().mockResolvedValue(item),
    } as never);
    vi.mocked(CollectionItem.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(item),
    } as never);
};

describe('Discogs album local edits', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stores only the edited fields on the collection item', async () => {
        const item = createItem();
        storeItem(item);

        const res = response();
        await updateDiscogsAlbum(
            request('item-1', { title: 'Kind of Blue (Mono)', year: '1958' }),
            res as never
        );

        expect(item.albumOverrides).toEqual({ title: 'Kind of Blue (Mono)', year: '1958' });
        expect(item.locallyModified).toBe(true);
        expect(res.status).toHaveBeenCalledWith(200);

        const payload = vi.mocked(res.json).mock.calls[0][0] as { item: { album: { title: string } } };
        expect(payload.item.album.title).toBe('Kind of Blue (Mono)');
    });

    it('saves an edited format on the collection item and clears the old verification', async () => {
        const item = createItem();
        storeItem(item);

        const res = response();
        await updateDiscogsAlbum(request('item-1', { format: 'CD' }), res as never);

        expect(item.format).toEqual({ name: 'CD', descriptions: [], text: 'CD' });
        expect(item.formatVerification).toBeNull();
        // The format is item data, not a local edit of the shared album.
        expect(item.albumOverrides).toBeNull();
        expect(item.locallyModified).toBe(false);
        expect(item.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);

        const payload = vi.mocked(res.json).mock.calls[0][0] as { item: { format: { name: string } } };
        expect(payload.item.format.name).toBe('CD');
    });

    it('keeps the format and its verification when the submitted format is unchanged', async () => {
        const item = createItem();
        const verification = item.formatVerification;
        storeItem(item);

        await updateDiscogsAlbum(request('item-1', { format: 'Vinyl' }), response() as never);

        expect(item.format).toEqual({ name: 'Vinyl', descriptions: ['LP', 'Album'], text: 'Vinyl LP' });
        expect(item.formatVerification).toBe(verification);
    });

    it('rejects a blank format without saving', async () => {
        const item = createItem();
        storeItem(item);

        const res = response();
        await updateDiscogsAlbum(request('item-1', { format: '   ' }), res as never);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(item.save).not.toHaveBeenCalled();
        expect(item.format.name).toBe('Vinyl');
    });

    it('saves custom field values on a Discogs item', async () => {
        const item = createItem();
        storeItem(item);
        vi.mocked(validateCustomFieldValues).mockResolvedValue({
            valid: true,
            sanitized: { 'field-binder': 'Shelf 3' },
        });

        const res = response();
        await updateDiscogsAlbum(
            request('item-1', { customFields: JSON.stringify({ 'field-binder': '  Shelf 3  ' }) }),
            res as never
        );

        expect(validateCustomFieldValues).toHaveBeenCalledWith('user-1', { 'field-binder': 'Shelf 3' });
        expect(item.customFields).toEqual(new Map([['field-binder', 'Shelf 3']]));
        expect(item.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('clears custom field values when all boxes are emptied', async () => {
        const item = createItem();
        item.customFields = new Map([['field-binder', 'Shelf 3']]);
        storeItem(item);
        vi.mocked(validateCustomFieldValues).mockResolvedValue({ valid: true, sanitized: {} });

        await updateDiscogsAlbum(request('item-1', { customFields: '{}' }), response() as never);

        expect(item.customFields).toEqual(new Map());
    });

    it('rejects invalid custom fields without saving', async () => {
        const item = createItem();
        storeItem(item);
        vi.mocked(validateCustomFieldValues).mockResolvedValue({
            valid: false,
            error: 'Unknown custom field: bad-id',
        });

        const res = response();
        await updateDiscogsAlbum(
            request('item-1', { customFields: JSON.stringify({ 'bad-id': 'nope' }) }),
            res as never
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(item.save).not.toHaveBeenCalled();
    });

    it('saves condition grades on the collection item', async () => {
        const item = createItem();
        storeItem(item);

        const res = response();
        await updateDiscogsAlbum(
            request('item-1', { mediaCondition: 'NM', sleeveCondition: '' }),
            res as never
        );

        expect(item.mediaCondition).toBe('NM');
        expect(item.sleeveCondition).toBeUndefined();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('stores broad genres and styles as separate local edits', async () => {
        const item = createItem();
        storeItem(item);

        const res = response();
        await updateDiscogsAlbum(
            request('item-1', { genres: 'Jazz, Blues', styles: 'Modal; Cool Jazz' }),
            res as never
        );

        expect(item.albumOverrides).toEqual({
            genres: ['Jazz', 'Blues'],
            styles: ['Modal', 'Cool Jazz']
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('does not touch the shared Album document', async () => {
        const item = createItem();
        storeItem(item);

        await updateDiscogsAlbum(request('item-1', { title: 'Local title' }), response() as never);

        expect(vi.mocked(item.album.save)).not.toHaveBeenCalled();
        expect(item.album.title).toBe(baseAlbum.title);
    });

    it('drops the override when the user restores the Discogs value', async () => {
        const item = createItem();
        item.albumOverrides = { title: 'Old local title' };
        item.locallyModified = true;
        storeItem(item);

        const res = response();
        await updateDiscogsAlbum(request('item-1', { title: baseAlbum.title }), res as never);

        expect(item.albumOverrides).toBeNull();
        expect(item.locallyModified).toBe(false);
    });

    it('rejects an edited album without a title or artist', async () => {
        const item = createItem();
        storeItem(item);

        const res = response();
        await updateDiscogsAlbum(request('item-1', { title: '   ' }), res as never);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(item.save).not.toHaveBeenCalled();
    });

    it('refuses to edit a manual album through this endpoint', async () => {
        const item = createItem({ isManual: true });
        storeItem(item);

        const res = response();
        await updateDiscogsAlbum(request('item-1', { title: 'Edited' }), res as never);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(item.save).not.toHaveBeenCalled();
    });

    it('restores the shared Discogs data and clears the flag', async () => {
        const item = createItem();
        item.albumOverrides = { title: 'Local title', cover_image: '/uploads/covers/mine.jpg' };
        item.locallyModified = true;
        storeItem(item);

        const res = response();
        await restoreDiscogsAlbum(request('item-1'), res as never);

        expect(item.albumOverrides).toBeNull();
        expect(item.locallyModified).toBe(false);
        expect(item.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);

        const payload = vi.mocked(res.json).mock.calls[0][0] as { restored: boolean };
        expect(payload.restored).toBe(true);
    });

    it('reports when there is nothing to restore', async () => {
        const item = createItem();
        storeItem(item);

        const res = response();
        await restoreDiscogsAlbum(request('item-1'), res as never);

        const payload = vi.mocked(res.json).mock.calls[0][0] as { restored: boolean };
        expect(payload.restored).toBe(false);
        expect(item.save).not.toHaveBeenCalled();
    });
});
