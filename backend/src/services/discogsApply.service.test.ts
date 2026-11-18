import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../models/CollectionItem', () => ({ default: { findOne: vi.fn(), exists: vi.fn() } }));
vi.mock('./discogs.service', () => ({
    discogsService: { fetchByReleaseId: vi.fn(), getMarketplaceStats: vi.fn() }
}));
vi.mock('./import.service', () => ({ upsertAlbumFromDiscogs: vi.fn(), processImportRow: vi.fn() }));

import CollectionItem from '../models/CollectionItem';
import { discogsService } from './discogs.service';
import { upsertAlbumFromDiscogs } from './import.service';
import { ApplySelection, planApply, relinkItem } from './discogsApply.service';
import { compareCollections, ComparableItem } from './discogsSync.service';
import type { DiscogsCollectionRelease } from '../types/discogs.types';

const oid = () => new mongoose.Types.ObjectId();

function entry(
    id: number,
    overrides: Partial<{ instanceId: number; dateAdded: string; artist: string; title: string; notes: DiscogsCollectionRelease['notes'] }> = {}
): DiscogsCollectionRelease {
    return {
        id,
        instance_id: overrides.instanceId ?? id * 10,
        date_added: overrides.dateAdded ?? '2018-02-25T15:25:00-08:00',
        notes: overrides.notes,
        basic_information: {
            id,
            title: overrides.title ?? `Title ${id}`,
            year: 1990,
            artists: [{ name: overrides.artist ?? `Artist ${id}` }],
            formats: [{ name: 'Vinyl' }]
        }
    };
}

function item(overrides: Partial<ComparableItem> = {}): ComparableItem {
    return {
        itemId: oid(),
        artist: 'Some Artist',
        title: 'Some Title',
        year: '1990',
        format: 'Vinyl',
        addedAt: new Date('2018-02-25T23:25:00Z'),
        ...overrides
    };
}

const none: ApplySelection = { add: [], relink: [], useDiscogsDates: false };

describe('planApply', () => {
    it('plans nothing the user did not tick', () => {
        const merged = item({ discogsId: 5, instanceId: 60, artist: 'Artist 6', title: 'Title 6' });
        const items = [merged, item({ discogsId: 1, instanceId: 10 })];
        const result = compareCollections([entry(1), entry(6, { instanceId: 60 }), entry(7)], items);
        expect(result.merged).toHaveLength(1);
        expect(result.newOnDiscogs.map(r => r.releaseId)).toEqual([7]);

        const plan = planApply(result, items, none);

        expect(plan.adds).toEqual([]);
        expect(plan.relinks).toEqual([]);
        expect(plan.dateUpdates).toEqual([]);
    });

    describe('adds', () => {
        it('plans a ticked new record with the Discogs entry it comes from', () => {
            const result = compareCollections([entry(7, { instanceId: 70 })], []);

            const plan = planApply(result, [], { ...none, add: [7] });

            expect(plan.adds).toHaveLength(1);
            expect(plan.adds[0].release).toMatchObject({ releaseId: 7, instanceId: 70 });
        });

        it('hands over the condition grades from the Discogs fields', () => {
            const notes = [
                { field_id: 1, value: 'Near Mint (NM or M-)' },
                { field_id: 2, value: 'Very Good Plus (VG+)' },
                { field_id: 3, value: 'Some free text' }
            ];
            const result = compareCollections([entry(7, { notes })], []);

            const [{ release }] = planApply(result, [], { ...none, add: [7] }).adds;

            expect(release).toMatchObject({ mediaCondition: 'NM', sleeveCondition: 'VG+' });
        });

        it('has no release for a tick that is no longer new, so it gets skipped', () => {
            const result = compareCollections([entry(7)], [item({ discogsId: 7 })]);

            const plan = planApply(result, [], { ...none, add: [7, 999] });

            expect(plan.adds).toEqual([{ releaseId: 7, release: undefined }, { releaseId: 999, release: undefined }]);
        });
    });

    describe('relinks', () => {
        it('plans a ticked merge, with the pairing it was ticked for', () => {
            const old = item({ discogsId: 5, instanceId: 60 });
            const result = compareCollections([entry(6, { instanceId: 60 })], [old]);

            const plan = planApply(result, [old], { ...none, relink: [{ itemId: String(old.itemId), releaseId: 6 }] });

            expect(plan.relinks).toHaveLength(1);
            expect(plan.relinks[0].merged).toMatchObject({ match: 'instance', release: { releaseId: 6 } });
        });

        it('drops a tick whose pairing changed since the user saw it', () => {
            const old = item({ discogsId: 5, instanceId: 60 });
            const result = compareCollections([entry(6, { instanceId: 60 })], [old]);

            const plan = planApply(result, [old], { ...none, relink: [{ itemId: String(old.itemId), releaseId: 1234 }] });

            expect(plan.relinks[0].merged).toBeUndefined();
        });

        it('drops a tick for an item that is not a merge', () => {
            const matched = item({ discogsId: 1 });
            const result = compareCollections([entry(1)], [matched]);

            const plan = planApply(result, [matched], { ...none, relink: [{ itemId: String(matched.itemId), releaseId: 1 }] });

            expect(plan.relinks[0].merged).toBeUndefined();
        });
    });

    describe('instance ids', () => {
        it('links matched items that have none, without being asked', () => {
            const unlinked = item({ discogsId: 1 });
            const linked = item({ discogsId: 2, instanceId: 20 });
            const result = compareCollections([entry(1, { instanceId: 11 }), entry(2, { instanceId: 20 })], [unlinked, linked]);

            const plan = planApply(result, [unlinked, linked], none);

            expect(plan.linkInstances).toEqual([{ itemId: unlinked.itemId, instanceId: 11 }]);
        });

        it('links an item with copies to the earliest one', () => {
            const owner = item({ discogsId: 1 });
            const result = compareCollections(
                [entry(1, { instanceId: 12, dateAdded: '2021-01-01T00:00:00Z' }), entry(1, { instanceId: 11, dateAdded: '2019-01-01T00:00:00Z' })],
                [owner]
            );

            expect(planApply(result, [owner], none).linkInstances).toEqual([{ itemId: owner.itemId, instanceId: 11 }]);
        });

        it('does not link items that are only in Musivault or merged', () => {
            const stray = item({ discogsId: 99 });
            const result = compareCollections([entry(1)], [stray]);

            expect(planApply(result, [stray], none).linkInstances).toEqual([]);
        });
    });

    describe('dates', () => {
        const discogsDate = '2018-02-25T15:25:00-08:00';

        it('plans the Discogs date for matched items more than a day off, when asked', () => {
            const stale = item({ discogsId: 1, addedAt: new Date('2026-09-01T10:00:00Z') });
            const result = compareCollections([entry(1, { dateAdded: discogsDate })], [stale]);

            const plan = planApply(result, [stale], { ...none, useDiscogsDates: true });

            expect(plan.dateUpdates).toEqual([{ itemId: stale.itemId, addedAt: new Date(discogsDate) }]);
        });

        it('plans nothing without being asked', () => {
            const stale = item({ discogsId: 1, addedAt: new Date('2026-09-01T10:00:00Z') });
            const result = compareCollections([entry(1, { dateAdded: discogsDate })], [stale]);

            expect(planApply(result, [stale], none).dateUpdates).toEqual([]);
        });

        it('plans an item that is only a couple of days off', () => {
            const near = item({ discogsId: 1, addedAt: new Date('2018-02-28T10:00:00Z') });
            const result = compareCollections([entry(1, { dateAdded: discogsDate })], [near]);

            expect(planApply(result, [near], { ...none, useDiscogsDates: true }).dateUpdates).toHaveLength(1);
        });

        it('leaves items within a day of Discogs alone', () => {
            const close = item({ discogsId: 1, addedAt: new Date('2018-02-26T10:00:00Z') });
            const result = compareCollections([entry(1, { dateAdded: discogsDate })], [close]);

            expect(planApply(result, [close], { ...none, useDiscogsDates: true }).dateUpdates).toEqual([]);
        });

        it('uses the earliest copy\'s date', () => {
            const stale = item({ discogsId: 1, addedAt: new Date('2026-09-01T10:00:00Z') });
            const result = compareCollections(
                [entry(1, { instanceId: 12, dateAdded: '2021-01-01T00:00:00Z' }), entry(1, { instanceId: 11, dateAdded: '2019-01-01T00:00:00Z' })],
                [stale]
            );

            const [update] = planApply(result, [stale], { ...none, useDiscogsDates: true }).dateUpdates;

            expect(update.addedAt).toEqual(new Date('2019-01-01T00:00:00Z'));
        });

        it('keeps the date of an item that is being relinked, and of one that is not matched', () => {
            const old = item({ discogsId: 5, instanceId: 60, addedAt: new Date('2026-09-01T10:00:00Z') });
            const stray = item({ discogsId: 99, addedAt: new Date('2026-09-01T10:00:00Z') });
            const result = compareCollections([entry(6, { instanceId: 60 })], [old, stray]);

            const plan = planApply(result, [old, stray], {
                ...none,
                relink: [{ itemId: String(old.itemId), releaseId: 6 }],
                useDiscogsDates: true
            });

            expect(plan.dateUpdates).toEqual([]);
        });
    });
});

describe('relinkItem', () => {
    const userId = oid();
    const oldAlbum = oid();
    const newAlbum = oid();
    const release = { releaseId: 6, instanceId: 60 };

    function stored() {
        return {
            _id: oid(),
            user: userId,
            album: oldAlbum,
            format: { name: 'Vinyl', descriptions: ['LP'], text: '' },
            mediaCondition: 'VG+',
            sleeveCondition: 'VG',
            customFields: new Map([['note', 'signed']]),
            addedAt: new Date('2020-05-01T12:00:00Z'),
            priceCache: { veryGoodPlus: 5, currency: 'USD' },
            formatVerification: { status: 'mismatch' },
            discogsInstanceId: undefined as number | undefined,
            save: vi.fn()
        };
    }

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(discogsService.fetchByReleaseId).mockResolvedValue({
            discogsId: 6, title: 'T', artist: 'A', year: '1990', thumb: '', cover_image: '',
            formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Reissue'], text: 'Clear' }]
        });
        vi.mocked(discogsService.getMarketplaceStats).mockResolvedValue({
            mint: null, nearMint: null, veryGoodPlus: 42, veryGood: null, goodPlus: null, good: null, fair: null, poor: null, currency: 'USD'
        });
        vi.mocked(upsertAlbumFromDiscogs).mockResolvedValue({ _id: newAlbum } as never);
        vi.mocked(CollectionItem.exists).mockResolvedValue(null);
    });

    it('moves the item to the new release and keeps what is the user\'s own', async () => {
        const item = stored();
        const before = { ...item };
        vi.mocked(CollectionItem.findOne).mockResolvedValue(item as never);

        expect(await relinkItem(userId, item._id, release)).toBeUndefined();

        expect(item.album).toBe(newAlbum);
        expect(item.discogsInstanceId).toBe(60);
        expect(item.save).toHaveBeenCalledTimes(1);
        // The user's own data
        expect(item.mediaCondition).toBe(before.mediaCondition);
        expect(item.sleeveCondition).toBe(before.sleeveCondition);
        expect(item.customFields).toBe(before.customFields);
        expect(item.customFields.get('note')).toBe('signed');
        expect(item.addedAt).toBe(before.addedAt);
        expect(item.format.name).toBe('Vinyl');
    });

    it('takes the format details, the price and a fresh verification from the new release', async () => {
        const item = stored();
        vi.mocked(CollectionItem.findOne).mockResolvedValue(item as never);

        await relinkItem(userId, item._id, release);

        expect(item.format).toMatchObject({ descriptions: ['LP', 'Reissue'], text: 'Clear' });
        expect(item.priceCache).toMatchObject({ veryGoodPlus: 42 });
        expect(item.formatVerification).toBeNull();
    });

    it('only looks at the user\'s own items', async () => {
        const item = stored();
        vi.mocked(CollectionItem.findOne).mockResolvedValue(item as never);

        await relinkItem(userId, item._id, release);

        expect(CollectionItem.findOne).toHaveBeenCalledWith({ _id: item._id, user: userId });
    });

    it('does not relink when the user already has the new release in that format', async () => {
        const item = stored();
        vi.mocked(CollectionItem.findOne).mockResolvedValue(item as never);
        vi.mocked(CollectionItem.exists).mockResolvedValue({ _id: oid() } as never);

        expect(await relinkItem(userId, item._id, release)).toMatch(/already/i);

        expect(item.album).toBe(oldAlbum);
        expect(item.save).not.toHaveBeenCalled();
    });

    it('reports an item that is gone, without calling Discogs', async () => {
        vi.mocked(CollectionItem.findOne).mockResolvedValue(null);

        expect(await relinkItem(userId, oid(), release)).toMatch(/no longer/i);

        expect(discogsService.fetchByReleaseId).not.toHaveBeenCalled();
    });

    it('throws, and changes nothing, when Discogs does not return the release', async () => {
        const item = stored();
        vi.mocked(CollectionItem.findOne).mockResolvedValue(item as never);
        vi.mocked(discogsService.fetchByReleaseId).mockResolvedValue(null);

        await expect(relinkItem(userId, item._id, release)).rejects.toThrow();

        expect(item.album).toBe(oldAlbum);
        expect(item.save).not.toHaveBeenCalled();
    });
});
