import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

const { stored } = vi.hoisted(() => ({ stored: { report: null as unknown } }));

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../models/User', () => ({ default: {} }));
vi.mock('../models/CollectionItem', () => ({ default: {} }));
vi.mock('../models/DiscogsSyncReport', () => ({
    default: { findOne: vi.fn(() => ({ select: async () => stored.report })) }
}));

import DiscogsSyncReport from '../models/DiscogsSyncReport';
import type { IUser } from '../models/User';
import { getPendingSummary } from './discogsSync.service';

const user = (discogs: Record<string, unknown> | undefined) => ({ _id: new mongoose.Types.ObjectId(), discogs }) as unknown as IUser;
const report = (overrides: Record<string, unknown> = {}) => ({
    finishedAt: new Date('2026-10-11T08:00:00Z'),
    startedAt: new Date('2026-10-11T07:59:00Z'),
    counts: { discogs: 100, matched: 90, newOnDiscogs: 3, merged: 2, onlyInMusivault: 4, dateDiffers: 7 },
    ...overrides
});

describe('getPendingSummary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stored.report = report();
    });

    it('counts what the user can act on: new and merged records', async () => {
        expect(await getPendingSummary(user({ enabled: true }))).toEqual({
            finishedAt: new Date('2026-10-11T08:00:00Z'),
            newOnDiscogs: 3,
            merged: 2
        });
    });

    it('leaves out date differences and records only in Musivault', async () => {
        const summary = await getPendingSummary(user({ enabled: true }));
        expect(summary).not.toHaveProperty('dateDiffers');
        expect(summary).not.toHaveProperty('onlyInMusivault');
    });

    it('only looks at a completed check of this user', async () => {
        const u = user({ enabled: true });

        await getPendingSummary(u);

        expect(DiscogsSyncReport.findOne).toHaveBeenCalledWith({ user: u._id, status: 'completed' });
    });

    it('is null when sync is off or the account is not connected', async () => {
        expect(await getPendingSummary(user({ enabled: false }))).toBeNull();
        expect(await getPendingSummary(user(undefined))).toBeNull();
    });

    it('is null when the token needs reconnecting, whatever the old report says', async () => {
        expect(await getPendingSummary(user({ enabled: true, needsReconnect: true }))).toBeNull();
    });

    it('is null before a first completed check', async () => {
        stored.report = null;
        expect(await getPendingSummary(user({ enabled: true }))).toBeNull();
    });

    it('falls back to the start time when the check has no finish time', async () => {
        stored.report = report({ finishedAt: undefined });
        expect((await getPendingSummary(user({ enabled: true })))?.finishedAt).toEqual(new Date('2026-10-11T07:59:00Z'));
    });
});
