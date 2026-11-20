import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPriceFallbackEnabled } from './price.utils';

describe('isPriceFallbackEnabled', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('is disabled by default', () => {
        vi.stubEnv('DISCOGS_PRICE_FALLBACK', '');
        expect(isPriceFallbackEnabled()).toBe(false);
    });

    it('accepts the usual boolean spellings', () => {
        for (const value of ['true', 'TRUE', '1', 'yes', 'on']) {
            vi.stubEnv('DISCOGS_PRICE_FALLBACK', value);
            expect(isPriceFallbackEnabled()).toBe(true);
        }
        for (const value of ['false', '0', 'no', 'off', 'nonsense']) {
            vi.stubEnv('DISCOGS_PRICE_FALLBACK', value);
            expect(isPriceFallbackEnabled()).toBe(false);
        }
    });
});
