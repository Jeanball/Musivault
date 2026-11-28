import { describe, expect, it, vi } from 'vitest';
import type { IUser } from '../models/User';

const { report } = vi.hoisted(() => ({
    report: {
        startedAt: new Date('2026-11-01T00:00:00Z'),
        counts: { newOnDiscogs: 3, merged: 1 },
        flags: [{ kind: 'possibleMove' }, { kind: 'possibleDuplicate' }]
    } as Record<string, unknown>
}));

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../models/DiscogsSyncReport', () => ({ default: { findOne: () => ({ select: async () => report }) } }));

import { getPendingSummary } from './discogsSync.service';

const user = { _id: 'u1', discogs: { enabled: true } } as unknown as IUser;

describe('getPendingSummary', () => {
    it('counts the flags, and a possible move once: not as a new record as well', async () => {
        expect(await getPendingSummary(user)).toMatchObject({ newOnDiscogs: 2, merged: 1, flagged: 2 });
    });

    it('reads a report from before flags existed', async () => {
        delete report.flags;

        expect(await getPendingSummary(user)).toMatchObject({ newOnDiscogs: 3, merged: 1, flagged: 0 });
    });
});
