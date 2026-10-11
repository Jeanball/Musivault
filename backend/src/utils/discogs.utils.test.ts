import { describe, expect, it, vi } from 'vitest';
import { MAX_RATE_LIMIT_RETRIES, parseDiscogsCondition, withRateLimitRetry } from './discogs.utils';

describe('parseDiscogsCondition', () => {
    it.each([
        ['Mint (M)', 'M'],
        ['Near Mint (NM or M-)', 'NM'],
        ['Very Good Plus (VG+)', 'VG+'],
        ['Very Good (VG)', 'VG'],
        ['Good Plus (G+)', 'G+'],
        ['Good (G)', 'G'],
        ['Fair (F)', 'F'],
        ['Poor (P)', 'P']
    ])('maps "%s" to %s', (value, code) => {
        expect(parseDiscogsCondition(value)).toBe(code);
    });

    it('returns undefined for an empty or missing value', () => {
        expect(parseDiscogsCondition(undefined)).toBeUndefined();
        expect(parseDiscogsCondition('')).toBeUndefined();
    });

    it('returns undefined for a grade it does not know', () => {
        expect(parseDiscogsCondition('Sealed (SEALED)')).toBeUndefined();
        expect(parseDiscogsCondition('Whatever')).toBeUndefined();
    });

    it('keeps the sleeve-only values for a sleeve, and drops them for the media', () => {
        expect(parseDiscogsCondition('Generic', { sleeve: true })).toBe('Generic');
        expect(parseDiscogsCondition('Not Graded', { sleeve: true })).toBe('Not Graded');
        expect(parseDiscogsCondition('No Cover', { sleeve: true })).toBe('No Cover');
        expect(parseDiscogsCondition('No Cover')).toBeUndefined();
    });

    it('still maps ordinary grades for a sleeve', () => {
        expect(parseDiscogsCondition('Very Good Plus (VG+)', { sleeve: true })).toBe('VG+');
    });
});

describe('withRateLimitRetry', () => {
    const throttled = () => Object.assign(new Error('429'), { isAxiosError: true, response: { status: 429 } });
    const failing = (status: number) => Object.assign(new Error(String(status)), { isAxiosError: true, response: { status } });
    const options = { context: 'test', waitMs: 1 };

    it('returns the result straight away when the request works', async () => {
        const request = vi.fn().mockResolvedValue('ok');

        expect(await withRateLimitRetry(request, options)).toBe('ok');
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('waits and tries again when Discogs throttles the request', async () => {
        const request = vi.fn().mockRejectedValueOnce(throttled()).mockRejectedValueOnce(throttled()).mockResolvedValue('ok');

        expect(await withRateLimitRetry(request, options)).toBe('ok');
        expect(request).toHaveBeenCalledTimes(3);
    });

    it('gives up after the retries and throws the 429', async () => {
        const request = vi.fn().mockRejectedValue(throttled());

        await expect(withRateLimitRetry(request, options)).rejects.toThrow('429');
        expect(request).toHaveBeenCalledTimes(MAX_RATE_LIMIT_RETRIES + 1);
    });

    it('does not retry any other error', async () => {
        const request = vi.fn().mockRejectedValue(failing(500));

        await expect(withRateLimitRetry(request, options)).rejects.toThrow('500');
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('does not retry an error that is not from Discogs', async () => {
        const request = vi.fn().mockRejectedValue(new Error('boom'));

        await expect(withRateLimitRetry(request, options)).rejects.toThrow('boom');
        expect(request).toHaveBeenCalledTimes(1);
    });
});
