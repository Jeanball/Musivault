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
vi.mock('../models/ImportLog', () => ({ default: {} }));
vi.mock('../models/User', () => ({ default: {} }));
vi.mock('./discogs.service', () => ({
    discogsService: { fetchByReleaseId: vi.fn(), searchByArtistAlbum: vi.fn(), searchByCatalogNumber: vi.fn(), getMarketplaceStats: vi.fn() }
}));

import CollectionItem from '../models/CollectionItem';
import { discogsService } from './discogs.service';
import { processImportRow } from './import.service';

const found = { discogsId: 7, title: 'T', artist: 'A', year: '1990', thumb: '', cover_image: '', formats: [{ name: 'Vinyl', qty: '1' }] };

describe('processImportRow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(discogsService.fetchByReleaseId).mockResolvedValue(found);
        vi.mocked(discogsService.getMarketplaceStats).mockResolvedValue(null);
    });

    it('does not retry throttled Discogs calls by default, as before', async () => {
        await processImportRow({ artist: 'A', album: 'T', releaseId: '7' }, 'user-1');

        expect(discogsService.fetchByReleaseId).toHaveBeenCalledWith('7', { retryOnRateLimit: undefined });
        expect(discogsService.getMarketplaceStats).toHaveBeenCalledWith(7, { retryOnRateLimit: undefined });
    });

    it('retries throttled calls for the release and the price when asked to', async () => {
        const result = await processImportRow({ artist: 'A', album: 'T', releaseId: '7' }, 'user-1', { retryOnRateLimit: true });

        expect(result.success).toBe(true);
        expect(discogsService.fetchByReleaseId).toHaveBeenCalledWith('7', { retryOnRateLimit: true });
        expect(discogsService.getMarketplaceStats).toHaveBeenCalledWith(7, { retryOnRateLimit: true });
    });

    it('gives the new item the date added and the Discogs entry it was told', async () => {
        const addedAt = new Date('2018-02-25T00:00:00Z');

        await processImportRow(
            { artist: 'A', album: 'T', releaseId: '7' },
            'user-1',
            { addedAt, discogsInstanceId: 99, formatName: 'Cassette' }
        );

        expect(vi.mocked(CollectionItem)).toHaveBeenCalledWith(expect.objectContaining({
            addedAt,
            discogsInstanceId: 99,
            format: expect.objectContaining({ name: 'Cassette' })
        }));
    });
});
