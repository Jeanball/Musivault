import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { discogsRequest, hasPAT, delay, withRateLimitRetry, logger } = vi.hoisted(() => ({
    discogsRequest: vi.fn(),
    hasPAT: vi.fn(),
    delay: vi.fn(),
    withRateLimitRetry: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../config/logger.config', () => ({ logger }));

vi.mock('../utils/discogs.utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../utils/discogs.utils')>();
    return { ...actual, discogsRequest, hasPAT, delay, withRateLimitRetry };
});

import { getMarketplaceStats } from './discogs.service';

const notFound = Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404 },
});

describe('Discogs marketplace price fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('DISCOGS_PAT', 'test-pat');
        vi.stubEnv('DISCOGS_PRICE_FALLBACK', 'false');
        hasPAT.mockReturnValue(true);
        delay.mockResolvedValue(undefined);
        withRateLimitRetry.mockImplementation(async (request: () => Promise<unknown>) => request());
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('keeps the normal behaviour when the switch is off', async () => {
        discogsRequest.mockRejectedValueOnce(notFound);

        const result = await getMarketplaceStats(101, { forceRefresh: true });

        expect(result).toBeNull();
        expect(discogsRequest).toHaveBeenCalledTimes(1);
        expect(discogsRequest).toHaveBeenCalledWith(
            '/marketplace/price_suggestions/101',
            {},
            { useTokenAuth: true }
        );
    });

    it('uses the lowest listing when price suggestions return 404', async () => {
        vi.stubEnv('DISCOGS_PRICE_FALLBACK', 'true');
        discogsRequest
            .mockRejectedValueOnce(notFound)
            .mockResolvedValueOnce({
                num_for_sale: 3,
                lowest_price: { value: 12.5, currency: 'EUR' },
                blocked_from_sale: false,
            });

        const result = await getMarketplaceStats(102, { forceRefresh: true });

        expect(result).toMatchObject({
            mint: 12.5,
            nearMint: 12.5,
            veryGoodPlus: 12.5,
            veryGood: 12.5,
            goodPlus: 12.5,
            good: 12.5,
            fair: 12.5,
            poor: 12.5,
            currency: 'USD',
        });
        expect(discogsRequest).toHaveBeenNthCalledWith(2, '/marketplace/stats/102');
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'price suggestions unavailable (404)' }),
            expect.stringContaining('lowest-price fallback')
        );
    });

    it('uses the fallback for an empty suggestions response too', async () => {
        vi.stubEnv('DISCOGS_PRICE_FALLBACK', 'yes');
        discogsRequest
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({
                num_for_sale: 1,
                lowest_price: { value: 7, currency: 'USD' },
            });

        const result = await getMarketplaceStats(103, { forceRefresh: true });

        expect(result?.veryGoodPlus).toBe(7);
        expect(discogsRequest).toHaveBeenNthCalledWith(2, '/marketplace/stats/103');
    });

    it('returns null when the fallback finds no listings', async () => {
        vi.stubEnv('DISCOGS_PRICE_FALLBACK', 'true');
        discogsRequest
            .mockRejectedValueOnce(notFound)
            .mockResolvedValueOnce({ num_for_sale: 0, lowest_price: null });

        const result = await getMarketplaceStats(104, { forceRefresh: true });

        expect(result).toBeNull();
    });

    it('can fall back without a Discogs personal access token', async () => {
        vi.stubEnv('DISCOGS_PRICE_FALLBACK', 'true');
        hasPAT.mockReturnValue(false);
        discogsRequest.mockResolvedValueOnce({
            num_for_sale: 2,
            lowest_price: { value: 5, currency: 'USD' },
        });

        const result = await getMarketplaceStats(105, { forceRefresh: true });

        expect(result?.veryGoodPlus).toBe(5);
        expect(discogsRequest).toHaveBeenCalledTimes(1);
        expect(discogsRequest).toHaveBeenCalledWith('/marketplace/stats/105');
    });
});
