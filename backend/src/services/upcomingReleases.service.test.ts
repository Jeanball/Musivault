import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/UpcomingRelease', () => ({
    default: { findOneAndUpdate: vi.fn(), exists: vi.fn() }
}));
vi.mock('./musicbrainz.service', () => ({
    fetchReleaseGroupsForStyle: vi.fn(),
    buildCoverArtUrl: (mbid: string) => `cover/${mbid}`,
    delay: vi.fn(async () => undefined),
    normalizeStyle: (s: string) => s.toLowerCase().trim(),
    MB_RATE_LIMIT_MS: 1100
}));

import UpcomingRelease from '../models/UpcomingRelease';
import { fetchReleaseGroupsForStyle } from './musicbrainz.service';
import { FOLLOW_DEBOUNCE_MS, queueStyleFetch, runExclusive, upcomingWindow } from './upcomingReleases.service';

const group = (mbid: string, extra = {}) => ({
    mbid, title: 't', artist: 'a', artistIds: ['x'], firstReleaseDate: '2026-11-01',
    datePrecision: 'day', primaryType: 'Album', secondaryTypes: [], ...extra
});

describe('queueStyleFetch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetAllMocks();
        vi.mocked(UpcomingRelease.exists).mockResolvedValue(null as never);
        vi.mocked(fetchReleaseGroupsForStyle).mockResolvedValue([group('1')] as never);
    });
    afterEach(() => vi.useRealTimers());

    it('waits for the debounce, then fetches each style once, lowercased', async () => {
        queueStyleFetch(['Jazz']);
        queueStyleFetch(['jazz', 'Funk']);
        await vi.advanceTimersByTimeAsync(FOLLOW_DEBOUNCE_MS - 1);
        expect(fetchReleaseGroupsForStyle).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        await vi.runAllTimersAsync();
        const styles = vi.mocked(fetchReleaseGroupsForStyle).mock.calls.map(c => c[0]);
        expect(styles).toEqual(['jazz', 'funk']);
        expect(UpcomingRelease.findOneAndUpdate).toHaveBeenCalledWith(
            { mbid: '1', style: 'jazz' }, expect.objectContaining({ style: 'jazz' }), expect.anything()
        );
    });

    it('skips a style that already has recently fetched releases', async () => {
        vi.mocked(UpcomingRelease.exists).mockResolvedValue({ _id: 'x' } as never);
        queueStyleFetch(['blues']);
        await vi.advanceTimersByTimeAsync(FOLLOW_DEBOUNCE_MS);
        await vi.runAllTimersAsync();
        expect(fetchReleaseGroupsForStyle).not.toHaveBeenCalled();
    });

    it('does not fetch the same style again right after fetching it', async () => {
        queueStyleFetch(['soul']);
        await vi.advanceTimersByTimeAsync(FOLLOW_DEBOUNCE_MS);
        await vi.runAllTimersAsync();
        queueStyleFetch(['soul']);
        await vi.advanceTimersByTimeAsync(FOLLOW_DEBOUNCE_MS);
        await vi.runAllTimersAsync();
        expect(fetchReleaseGroupsForStyle).toHaveBeenCalledTimes(1);
    });

    it('keeps going when one style fails', async () => {
        vi.mocked(fetchReleaseGroupsForStyle)
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce([] as never);
        queueStyleFetch(['ska', 'dub']);
        await vi.advanceTimersByTimeAsync(FOLLOW_DEBOUNCE_MS);
        await vi.runAllTimersAsync();
        expect(fetchReleaseGroupsForStyle).toHaveBeenCalledTimes(2);
    });

    it('stores only Album/EP release groups with a day or month date', async () => {
        vi.mocked(fetchReleaseGroupsForStyle).mockResolvedValue([
            group('ok'), group('year', { datePrecision: 'year' }), group('single', { primaryType: 'Single' })
        ] as never);
        queueStyleFetch(['folk']);
        await vi.advanceTimersByTimeAsync(FOLLOW_DEBOUNCE_MS);
        await vi.runAllTimersAsync();
        expect(UpcomingRelease.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });
});

describe('runExclusive', () => {
    it('runs jobs one after another, even after a failure', async () => {
        const order: string[] = [];
        const slow = runExclusive(async () => { await Promise.resolve(); order.push('a'); throw new Error('x'); });
        const next = runExclusive(async () => { order.push('b'); });
        await expect(slow).rejects.toThrow('x');
        await next;
        expect(order).toEqual(['a', 'b']);
    });
});

describe('upcomingWindow', () => {
    it('spans 14 days back to 60 days ahead', () => {
        expect(upcomingWindow(new Date('2026-10-28T12:00:00Z'))).toEqual({ dateFrom: '2026-10-14', dateTo: '2026-12-27' });
    });
});
