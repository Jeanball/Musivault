import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

const { reports, users, discogsRequest, storedItems, bulkWrite } = vi.hoisted(() => ({
    storedItems: [] as unknown[],
    bulkWrite: vi.fn(),
    reports: new Map<string, { status: string }>(),
    users: [] as { _id: unknown; discogs: { enabled: boolean; source: string; username: string; needsReconnect?: boolean } }[],
    discogsRequest: vi.fn()
}));

/** A mongoose-like query: awaitable, with `.select()` returning the same value. */
const query = <T>(value: T) => Object.assign(Promise.resolve(value), { select: () => Promise.resolve(value) });

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../models/User', () => ({
    default: {
        find: vi.fn(() => query(users)),
        findById: vi.fn((id: unknown) => query(users.find(u => String(u._id) === String(id)) ?? null)),
        updateOne: vi.fn(async () => undefined)
    }
}));
vi.mock('../models/DiscogsSyncReport', () => ({
    default: {
        findOne: vi.fn(async ({ user }: { user: unknown }) => reports.get(String(user)) ?? null),
        findOneAndUpdate: vi.fn(async ({ user }: { user: unknown }) => {
            const report = { status: 'queued' };
            reports.set(String(user), report);
            return report;
        }),
        updateOne: vi.fn(async ({ user }: { user: unknown }, update: { $set?: { status?: string } }) => {
            const status = update.$set?.status;
            if (status) reports.set(String(user), { status });
        })
    }
}));
vi.mock('../models/CollectionItem', () => ({
    default: { find: () => ({ populate: () => ({ lean: async () => storedItems }) }), bulkWrite }
}));
vi.mock('../utils/discogs.utils', async importOriginal => ({
    ...(await importOriginal<typeof import('../utils/discogs.utils')>()),
    discogsRequest,
    delay: async () => undefined
}));

import User from '../models/User';
import { checkAllUsers, startCheck } from './discogsSync.service';

const emptyPage = { pagination: { page: 1, pages: 1, items: 0 }, releases: [] };
const addUser = (username: string, overrides: Partial<(typeof users)[number]['discogs']> = {}) => {
    const user = { _id: new mongoose.Types.ObjectId(), discogs: { enabled: true, source: 'server', username, ...overrides } };
    users.push(user);
    return user;
};
const rejected = (status: number) => Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status } });

describe('checkAllUsers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.DISCOGS_PAT = 'server-token';
        reports.clear();
        users.length = 0;
        storedItems.length = 0;
        discogsRequest.mockReset();
        discogsRequest.mockResolvedValue(emptyPage);
    });

    it('saves the clear Discogs links it finds, without waiting for an apply', async () => {
        const user = addUser('linked');
        const itemId = new mongoose.Types.ObjectId();
        storedItems.push({
            _id: itemId, addedAt: new Date('2020-01-01T00:00:00Z'), format: { name: 'Vinyl' },
            album: { discogsId: 1, title: 'T', artist: 'A', year: '1990' }
        });
        discogsRequest.mockResolvedValue({
            pagination: { page: 1, pages: 1, items: 1 },
            releases: [{
                id: 1, instance_id: 11, date_added: '2020-01-01T00:00:00Z',
                basic_information: { id: 1, title: 'T', year: 1990, artists: [{ name: 'A' }], formats: [{ name: 'Vinyl' }] }
            }]
        });

        await checkAllUsers();

        expect(bulkWrite).toHaveBeenCalledWith([{
            updateOne: {
                filter: { _id: itemId, user: user._id, discogsInstanceId: null },
                update: { $set: { discogsInstanceId: 11 } }
            }
        }]);
    });

    it('does nothing when no one has sync on', async () => {
        expect(await checkAllUsers()).toEqual({ checked: 0, failed: 0, skipped: 0 });
        expect(discogsRequest).not.toHaveBeenCalled();
    });

    it('only asks for users with sync on whose token still works', async () => {
        await checkAllUsers();

        expect(User.find).toHaveBeenCalledWith({ 'discogs.enabled': true, 'discogs.needsReconnect': { $ne: true } });
    });

    it('checks every user, one after another, and tells which one is next', async () => {
        addUser('first');
        addUser('second');
        const seen: [number, number, string][] = [];

        const result = await checkAllUsers((current, total, username) => seen.push([current, total, username]));

        expect(result).toEqual({ checked: 2, failed: 0, skipped: 0 });
        expect(seen).toEqual([[1, 2, 'first'], [2, 2, 'second']]);
        expect(discogsRequest).toHaveBeenCalledTimes(2);
        expect(discogsRequest.mock.calls.map(c => c[0])).toEqual([
            '/users/first/collection/folders/0/releases',
            '/users/second/collection/folders/0/releases'
        ]);
    });

    it('goes on with the others when one check fails', async () => {
        addUser('first');
        addUser('broken');
        addUser('third');
        discogsRequest.mockResolvedValueOnce(emptyPage).mockRejectedValueOnce(rejected(500)).mockResolvedValueOnce(emptyPage);

        expect(await checkAllUsers()).toEqual({ checked: 2, failed: 1, skipped: 0 });
    });

    it('marks a user whose token Discogs rejected as needing a reconnect', async () => {
        const user = addUser('revoked');
        discogsRequest.mockRejectedValueOnce(rejected(401));

        expect(await checkAllUsers()).toEqual({ checked: 0, failed: 1, skipped: 0 });
        expect(User.updateOne).toHaveBeenCalledWith({ _id: user._id }, { $set: { 'discogs.needsReconnect': true } });
    });

    it('leaves out a user whose own check is already running', async () => {
        const busy = addUser('busy');
        addUser('idle');
        const running = startCheck(busy._id as mongoose.Types.ObjectId);
        await running;

        const result = await checkAllUsers();

        expect(result.skipped).toBe(1);
        expect(result.checked).toBe(1);
    });
});
