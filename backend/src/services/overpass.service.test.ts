import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn(), isAxiosError: vi.fn(() => false) } }));
vi.mock('../models/RecordShopCache', () => ({
    default: { find: vi.fn(), findOneAndUpdate: vi.fn(async () => null) }
}));

import axios from 'axios';
import RecordShopCache from '../models/RecordShopCache';
import { getShopsForPosition, OVERPASS_URLS } from './overpass.service';

const shopElement = { type: 'node', id: 1, lat: 48.85, lon: 2.35, tags: { shop: 'music', name: 'Disques' } };

/** Runs the call while advancing the fake clock past the 1.1 s pauses between requests. */
async function run<T>(promise: Promise<T>): Promise<T> {
    const settled = promise.then((value) => ({ value }), (error) => ({ error }));
    await vi.runAllTimersAsync();
    const result = await settled;
    if ('error' in result) throw result.error;
    return result.value;
}

describe('getShopsForPosition', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        vi.mocked(RecordShopCache.find).mockReturnValue({ lean: async () => [] } as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('tries the public instances in order: overpass-api.de, openstreetmap.fr, lz4', () => {
        expect(OVERPASS_URLS.map((url) => new URL(url).hostname)).toEqual([
            'overpass-api.de',
            'overpass.openstreetmap.fr',
            'lz4.overpass-api.de',
        ]);
    });

    it('moves on to the next instance when one is down, and caches the result', async () => {
        vi.mocked(axios.post)
            .mockRejectedValueOnce(new Error('504'))
            .mockResolvedValueOnce({ data: { elements: [shopElement] } });

        const shops = await run(getShopsForPosition(48.85, 2.35, 25));

        expect(shops).toHaveLength(1);
        expect(vi.mocked(axios.post).mock.calls.map((call) => call[0])).toEqual([OVERPASS_URLS[0], OVERPASS_URLS[1]]);
        expect(RecordShopCache.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('treats a 200 without elements as a failure and tries the next instance', async () => {
        vi.mocked(axios.post)
            .mockResolvedValueOnce({ data: '<html>dispatcher down</html>' })
            .mockResolvedValueOnce({ data: { elements: [shopElement] } });

        const shops = await run(getShopsForPosition(48.85, 2.35, 25));

        expect(shops).toHaveLength(1);
        expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('throws, and caches nothing, when every instance fails and there is no cached tile', async () => {
        vi.mocked(axios.post).mockRejectedValue(new Error('504'));

        await expect(run(getShopsForPosition(48.85, 2.35, 25))).rejects.toThrow('504');

        expect(axios.post).toHaveBeenCalledTimes(OVERPASS_URLS.length);
        expect(RecordShopCache.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('serves a stale cached tile when every instance fails', async () => {
        const stale = { tileKey: 'x', fetchedAt: new Date(0), shops: [{ name: 'Old shop' }] };
        vi.mocked(RecordShopCache.find).mockReturnValue({ lean: async () => [stale] } as never);
        vi.mocked(axios.post).mockRejectedValue(new Error('504'));

        const shops = await run(getShopsForPosition(48.85, 2.35, 25));

        expect(shops).toBe(stale.shops);
    });
});
