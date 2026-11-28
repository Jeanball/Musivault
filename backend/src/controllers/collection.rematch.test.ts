import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { rematchAlbum } from './collection.controller';
import CollectionItem from '../models/CollectionItem';
import { discogsRequest } from '../utils/discogs.utils';

vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../models/CollectionItem', () => ({
    default: { findOne: vi.fn(), findById: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('../utils/discogs.utils', async importOriginal => ({
    ...await importOriginal<typeof import('../utils/discogs.utils')>(),
    discogsRequest: vi.fn(),
}));
vi.mock('../services/discogs.service', () => ({
    getMarketplaceStats: vi.fn().mockResolvedValue(null),
    mapReleaseToAlbumUpdate: vi.fn(() => ({})),
}));
vi.mock('../utils/cover.utils', () => ({ downloadCoverToLocal: vi.fn().mockResolvedValue(null) }));

const createItem = (save = vi.fn().mockResolvedValue(undefined)) => ({
    _id: 'item-1',
    album: { _id: 'album-1', discogsId: 123, save: vi.fn().mockResolvedValue(undefined) },
    format: { name: 'Vinyl', descriptions: [], text: '' },
    albumOverrides: null,
    locallyModified: false,
    save,
});

const rematch = async (item: ReturnType<typeof createItem>, newDiscogsId: number) => {
    vi.mocked(CollectionItem.findOne).mockReturnValue({ populate: vi.fn().mockResolvedValue(item) } as never);
    vi.mocked(CollectionItem.findById).mockReturnValue({ populate: vi.fn().mockResolvedValue(null) } as never);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await rematchAlbum(
        { user: { _id: 'user-1' }, params: { itemId: 'item-1' }, body: { newDiscogsId } } as unknown as Request,
        res as unknown as Response
    );
    return res;
};

describe('rematchAlbum and the stored Discogs instance id', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(discogsRequest).mockResolvedValue({} as never);
    });

    it('drops it from every item on the album when the release changes', async () => {
        const res = await rematch(createItem(), 456);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(CollectionItem.updateMany).toHaveBeenCalledWith({ album: 'album-1' }, { $unset: { discogsInstanceId: 1 } });
    });

    it('keeps it when the release stays the same', async () => {
        const res = await rematch(createItem(), 123);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(CollectionItem.updateMany).not.toHaveBeenCalled();
    });

    it('keeps it when the rematch cannot be saved', async () => {
        const duplicate = Object.assign(new Error('duplicate key'), { code: 11000 });

        const res = await rematch(createItem(vi.fn().mockRejectedValue(duplicate)), 456);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(CollectionItem.updateMany).not.toHaveBeenCalled();
    });
});
