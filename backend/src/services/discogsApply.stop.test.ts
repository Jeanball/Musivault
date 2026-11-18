import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

const { reportUpdates, state } = vi.hoisted(() => ({
    reportUpdates: [] as Record<string, unknown>[],
    state: { active: false, applyRunning: true }
}));

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../models/CollectionItem', () => ({ default: { bulkWrite: vi.fn(), findOne: vi.fn(), exists: vi.fn() } }));
vi.mock('../models/User', () => ({
    default: { findById: vi.fn(async () => ({ discogs: { enabled: true, needsReconnect: false } })) }
}));
vi.mock('../models/DiscogsSyncReport', () => ({
    default: {
        updateOne: vi.fn(async (_filter: unknown, update: { $set: Record<string, unknown> }) => {
            reportUpdates.push(update.$set);
            return { matchedCount: 1 };
        }),
        findOne: vi.fn(async () => ({ status: 'completed' })),
        exists: vi.fn(async () => (state.applyRunning ? { _id: 1 } : null))
    }
}));
vi.mock('./discogs.service', () => ({ discogsService: {} }));
vi.mock('./import.service', () => ({ processImportRow: vi.fn(), upsertAlbumFromDiscogs: vi.fn() }));
vi.mock('./valueSnapshot.service', () => ({ rebuildValueHistory: vi.fn(), recordValueSnapshot: vi.fn() }));
vi.mock('./discogsSync.service', async importOriginal => ({
    ...(await importOriginal<typeof import('./discogsSync.service')>()),
    hasActiveJob: vi.fn(() => state.active),
    getReport: vi.fn(async () => null),
    // Busy only while the job runs, like the real queue.
    enqueueJob: vi.fn((_id: unknown, job: () => Promise<void>) => {
        state.active = true;
        return job().finally(() => { state.active = false; });
    }),
    fetchCollection: vi.fn(),
    loadItems: vi.fn(async () => []),
    saveResult: vi.fn(async () => undefined)
}));

import CollectionItem from '../models/CollectionItem';
import { fetchCollection, hasActiveJob } from './discogsSync.service';
import { processImportRow } from './import.service';
import { DiscogsApplyError, startApply, stopApply } from './discogsApply.service';
import type { DiscogsCollectionRelease } from '../types/discogs.types';

const entry = (id: number): DiscogsCollectionRelease => ({
    id, instance_id: id * 10, date_added: '2020-01-01T00:00:00Z',
    basic_information: { id, title: `Title ${id}`, year: 1990, artists: [{ name: 'A' }], formats: [{ name: 'Vinyl' }] }
});
const userId = new mongoose.Types.ObjectId();
const lastUpdate = () => Object.assign({}, ...reportUpdates);
/** `startApply` returns once the job is queued; wait for the job to be over. */
const settled = () => vi.waitFor(() => expect(state.active).toBe(false));
const apply = async (selection: Parameters<typeof startApply>[1]) => {
    await startApply(userId, selection);
    await settled();
};

describe('stopApply', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        reportUpdates.length = 0;
        state.active = false;
        state.applyRunning = true;
        vi.mocked(hasActiveJob).mockImplementation(() => state.active);
        vi.mocked(fetchCollection).mockResolvedValue([entry(1), entry(2), entry(3)]);
        vi.mocked(processImportRow).mockResolvedValue({ success: true });
    });

    it('refuses when no apply is running', async () => {
        state.active = false;

        await expect(stopApply(userId)).rejects.toMatchObject({ code: 'notRunning' });
        await expect(stopApply(userId)).rejects.toBeInstanceOf(DiscogsApplyError);
    });

    it('refuses when the user\'s job is a check, not an apply', async () => {
        state.applyRunning = false;

        await expect(stopApply(userId)).rejects.toMatchObject({ code: 'notRunning' });
    });

    it('records the request so the page can say it is stopping', async () => {
        state.active = true;

        await stopApply(userId);

        expect(lastUpdate()).toMatchObject({ 'apply.stopRequested': true });
    });

    it('ends after the record it is on, keeps what is done, and leaves the dates alone', async () => {
        vi.mocked(processImportRow).mockImplementationOnce(async () => {
            await stopApply(userId);
            return { success: true };
        });

        await apply({ add: [1, 2, 3], relink: [], useDiscogsDates: true });

        expect(processImportRow).toHaveBeenCalledTimes(1);
        expect(lastUpdate()).toMatchObject({
            'apply.status': 'completed',
            'apply.stopped': true,
            'apply.added': 1,
            'apply.done': 1,
            'apply.datesUpdated': 0
        });
        expect(CollectionItem.bulkWrite).not.toHaveBeenCalled();
    });

    it('is not stopped by an earlier stop: a new apply runs everything', async () => {
        vi.mocked(processImportRow).mockImplementationOnce(async () => {
            await stopApply(userId);
            return { success: true };
        });
        await apply({ add: [1, 2, 3], relink: [], useDiscogsDates: false });
        vi.mocked(processImportRow).mockClear();
        reportUpdates.length = 0;

        await apply({ add: [1, 2, 3], relink: [], useDiscogsDates: false });

        expect(processImportRow).toHaveBeenCalledTimes(3);
        expect(lastUpdate()).toMatchObject({ 'apply.status': 'completed', 'apply.stopped': false, 'apply.added': 3 });
    });

    it('a run that nobody stopped is not marked as stopped', async () => {
        await apply({ add: [1, 2], relink: [], useDiscogsDates: false });

        expect(lastUpdate()).toMatchObject({ 'apply.stopped': false, 'apply.added': 2 });
    });

    it('adds each record with its Discogs date and entry, and waits out Discogs\' rate limit', async () => {
        await apply({ add: [1], relink: [], useDiscogsDates: false });

        expect(processImportRow).toHaveBeenCalledWith(
            expect.objectContaining({ releaseId: '1' }),
            userId,
            expect.objectContaining({ discogsInstanceId: 10, addedAt: new Date('2020-01-01T00:00:00Z'), retryOnRateLimit: true })
        );
    });
});
