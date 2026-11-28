import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import fs from 'fs';
import { rematchAlbum } from './collection.controller';
import CollectionItem from '../models/CollectionItem';
import { upsertAlbumFromDiscogs } from '../services/import.service';
import { discogsRequest } from '../utils/discogs.utils';

vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../models/CollectionItem', () => ({
    default: { findOne: vi.fn(), findById: vi.fn(), exists: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('../services/import.service', () => ({ csvImportService: {}, upsertAlbumFromDiscogs: vi.fn() }));
vi.mock('../utils/discogs.utils', async importOriginal => ({
    ...await importOriginal<typeof import('../utils/discogs.utils')>(),
    discogsRequest: vi.fn(),
}));
vi.mock('../services/discogs.service', async importOriginal => ({
    mapReleaseToAlbumUpdate: (await importOriginal<typeof import('../services/discogs.service')>()).mapReleaseToAlbumUpdate,
    getMarketplaceStats: vi.fn().mockResolvedValue(null),
}));

const CUSTOM_COVER = '/uploads/covers/custom.jpg';

const oldAlbum = () => ({
    _id: 'album-old', discogsId: 123, artist: 'Old Artist', title: 'Pressing A', year: '1991',
    cover_image: '/uploads/covers/old.jpg', thumb: '/uploads/covers/old.jpg', genres: ['Rock'], styles: ['Thrash'],
    save: vi.fn(),
});
const targetAlbum = { _id: 'album-new', discogsId: 456, cover_image: '/uploads/covers/new.jpg' };

const createItem = (overrides: Record<string, unknown> = {}) => ({
    _id: 'item-1',
    album: oldAlbum() as unknown,
    format: { name: 'Vinyl', descriptions: ['LP'], text: '' },
    albumOverrides: { cover_image: CUSTOM_COVER } as unknown,
    locallyModified: true,
    discogsInstanceId: 100 as number | undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
});

const rematch = async (item: ReturnType<typeof createItem>, body: Record<string, unknown> = { newDiscogsId: 456 }) => {
    vi.mocked(CollectionItem.findOne).mockReturnValue({ populate: vi.fn().mockResolvedValue(item) } as never);
    vi.mocked(CollectionItem.findById).mockReturnValue({ populate: vi.fn().mockResolvedValue(null) } as never);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await rematchAlbum(
        { user: { _id: 'user-1' }, params: { itemId: 'item-1' }, body } as unknown as Request,
        res as unknown as Response
    );
    return res;
};

describe('rematchAlbum', () => {
    let unlink: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        unlink = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
        vi.mocked(discogsRequest).mockResolvedValue({ title: 'Pressing B' } as never);
        vi.mocked(upsertAlbumFromDiscogs).mockResolvedValue(targetAlbum as never);
        vi.mocked(CollectionItem.exists).mockResolvedValue(null);
    });

    it('moves only this record: the old album entry is not rewritten and no other record is touched', async () => {
        const item = createItem();
        const album = item.album as ReturnType<typeof oldAlbum>;

        const res = await rematch(item);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(item.album).toBe('album-new');
        expect(item.save).toHaveBeenCalled();
        expect(album).toMatchObject({ discogsId: 123, title: 'Pressing A' });
        expect(album.save).not.toHaveBeenCalled();
        expect(CollectionItem.updateMany).not.toHaveBeenCalled();
    });

    it('finds or creates the target album from the new release, without the old pressing\'s details', async () => {
        await rematch(createItem());

        expect(upsertAlbumFromDiscogs).toHaveBeenCalledWith(expect.objectContaining({
            discogsId: 456, title: 'Pressing B', artist: 'Old Artist', year: '', cover_image: '', genres: [], styles: []
        }));
    });

    it('refuses a real duplicate and changes nothing: no save, and the custom cover stays', async () => {
        vi.mocked(CollectionItem.exists).mockResolvedValue({ _id: 'item-2' } as never);
        const item = createItem();

        const res = await rematch(item);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(CollectionItem.exists).toHaveBeenCalledWith({
            user: 'user-1', album: 'album-new', 'format.name': 'Vinyl', _id: { $ne: 'item-1' }
        });
        expect(item.save).not.toHaveBeenCalled();
        expect(unlink).not.toHaveBeenCalled();
    });

    it('looks for a duplicate in the format sent with the request, and stores it', async () => {
        const item = createItem();

        await rematch(item, { newDiscogsId: 456, format: { name: 'CD', descriptions: ['Album'], text: 'x' } });

        expect(CollectionItem.exists).toHaveBeenCalledWith(expect.objectContaining({ 'format.name': 'CD' }));
        expect(item.format).toEqual({ name: 'CD', descriptions: ['Album'], text: 'x' });
    });

    it('clears local edits and deletes the custom cover only after the record is saved', async () => {
        const item = createItem();

        await rematch(item);

        expect(item).toMatchObject({ albumOverrides: null, locallyModified: false });
        expect(unlink).toHaveBeenCalledWith(expect.stringContaining('custom.jpg'));
        expect(unlink.mock.invocationCallOrder[0]).toBeGreaterThan(item.save.mock.invocationCallOrder[0]);
    });

    it('keeps the custom cover when saving the record fails', async () => {
        const res = await rematch(createItem({ save: vi.fn().mockRejectedValue(new Error('write failed')) }));

        expect(res.status).toHaveBeenCalledWith(500);
        expect(unlink).not.toHaveBeenCalled();
    });

    it.each([
        ['old', '/uploads/covers/old.jpg'],
        ['new', '/uploads/covers/new.jpg']
    ])('never deletes a cover the %s album entry uses', async (_which, cover) => {
        await rematch(createItem({ albumOverrides: { cover_image: cover } }));

        expect(unlink).not.toHaveBeenCalled();
    });

    it('clears the instance id on this record when the release changes', async () => {
        const item = createItem();

        await rematch(item);

        expect(item.discogsInstanceId).toBeUndefined();
    });

    it('keeps the instance id when the release stays the same', async () => {
        vi.mocked(upsertAlbumFromDiscogs).mockResolvedValue({ ...targetAlbum, _id: 'album-old', discogsId: 123 } as never);
        const item = createItem();

        await rematch(item, { newDiscogsId: 123 });

        expect(item.discogsInstanceId).toBe(100);
    });
});
