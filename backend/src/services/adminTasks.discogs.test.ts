import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./discogsSync.service', () => ({ checkAllUsers: vi.fn() }));
vi.mock('../controllers/collection.controller', () => ({ executePriceSync: vi.fn() }));
vi.mock('./upcomingReleases.service', () => ({
    upcomingWindow: vi.fn(),
    runExclusive: vi.fn(),
    refreshStyle: vi.fn()
}));

import { checkAllUsers } from './discogsSync.service';
import { getAdminTaskDefinition } from './adminTasks.service';

const task = () => getAdminTaskDefinition('check-discogs-collections')!;

describe('check-discogs-collections task', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('is registered to run weekly', () => {
        expect(task()).toBeDefined();
        expect(task().intervalMs).toBe(7 * 24 * 60 * 60 * 1000);
        expect(task().intervalLabel).toBe('7 days');
    });

    it('is due straight away the first time, then a week after the last run', async () => {
        const first = await task().getNextExecutionAt(null);
        expect(Math.abs((first as Date).getTime() - Date.now())).toBeLessThan(1000);

        const lastRun = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const next = (await task().getNextExecutionAt({
            taskId: 'check-discogs-collections', executedAt: lastRun, durationMs: 1, status: 'success', trigger: 'auto'
        })) as Date;
        expect(next.getTime()).toBe(lastRun.getTime() + 7 * 24 * 60 * 60 * 1000);
    });

    it('reports progress per user and a summary when it is done', async () => {
        vi.mocked(checkAllUsers).mockImplementation(async onUser => {
            onUser?.(1, 2, 'first');
            onUser?.(2, 2, 'second');
            return { checked: 2, failed: 0, skipped: 0 };
        });
        const events: Record<string, unknown>[] = [];

        const summary = await task().runBackground(e => events.push(e), { forceRefresh: false });

        expect(summary).toBe('Checked 2 Discogs collection(s), 0 failed, 0 skipped (busy).');
        expect(events).toEqual([
            { type: 'progress', current: 1, total: 2, label: 'first' },
            { type: 'progress', current: 2, total: 2, label: 'second' },
            { type: 'complete', message: summary }
        ]);
    });

    it('succeeds when only some checks failed, and says so', async () => {
        vi.mocked(checkAllUsers).mockResolvedValue({ checked: 1, failed: 1, skipped: 1 });

        expect(await task().runBackground(() => undefined, { forceRefresh: false })).toContain('1 failed');
    });

    it('succeeds when no one has sync on', async () => {
        vi.mocked(checkAllUsers).mockResolvedValue({ checked: 0, failed: 0, skipped: 0 });

        await expect(task().runBackground(() => undefined, { forceRefresh: false })).resolves.toContain('Checked 0');
    });

    it('fails when every check failed, so the scheduler retries it', async () => {
        vi.mocked(checkAllUsers).mockResolvedValue({ checked: 0, failed: 2, skipped: 0 });

        await expect(task().runBackground(() => undefined, { forceRefresh: false })).rejects.toThrow('2 failed');
    });
});
