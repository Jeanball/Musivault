import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

const items: Record<string, unknown>[] = [];
const snapshots: { _id: string; day: string; capturedAt: Date }[] = [];

vi.mock('../models/CollectionItem', () => ({
    default: { find: () => ({ select: () => ({ sort: () => ({ lean: async () => items }) }) }) }
}));
vi.mock('../models/ValueSnapshot', () => ({
    default: {
        find: () => ({ select: () => ({ lean: async () => snapshots }) }),
        deleteMany: vi.fn(async () => undefined),
        findOneAndUpdate: vi.fn(async () => undefined)
    }
}));

import ValueSnapshot from '../models/ValueSnapshot';
import { getValueForItem, rebuildValueHistory } from './valueSnapshot.service';

const user = new mongoose.Types.ObjectId();
const priced = (addedAt: Date, veryGoodPlus: number) => ({ addedAt, priceCache: { veryGoodPlus, currency: 'USD' } });
const written = () => vi.mocked(ValueSnapshot.findOneAndUpdate).mock.calls.map(([filter, update]) => {
    const { totalValue, itemCount } = (update as { $set: { totalValue: number; itemCount: number } }).$set;
    return { day: (filter as { day: string }).day, totalValue, itemCount };
});

describe('getValueForItem', () => {
    it('prefers the hand-entered value of a manual album over a cached price', () => {
        expect(getValueForItem({ manualValue: 42.5, priceCache: { veryGoodPlus: 10 } })).toBe(42.5);
    });

    it('falls back to the condition price when no manual value is set', () => {
        expect(getValueForItem({ manualValue: null, mediaCondition: 'VG+', priceCache: { veryGoodPlus: 10, currency: 'USD' } })).toBe(10);
    });

    it('ignores a zero manual value so it cannot mask a cached price', () => {
        expect(getValueForItem({ manualValue: 0, priceCache: { veryGoodPlus: 10, currency: 'USD' } })).toBe(10);
    });
});

describe('rebuildValueHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        items.length = 0;
        snapshots.length = 0;
    });

    it('accumulates the items\' current prices from the day each was added', async () => {
        items.push(
            priced(new Date(2020, 0, 5, 9), 10),
            priced(new Date(2020, 0, 5, 18), 5),
            priced(new Date(2020, 0, 9, 12), 20.5)
        );

        expect(await rebuildValueHistory(user)).toBe(2);

        expect(written()).toEqual([
            { day: '2020-01-05', totalValue: 15, itemCount: 2 },
            { day: '2020-01-09', totalValue: 35.5, itemCount: 3 }
        ]);
    });

    it('leaves items without a price out of the curve', async () => {
        items.push({ addedAt: new Date(2020, 0, 5, 9), priceCache: null }, priced(new Date(2020, 0, 6, 9), 8));

        await rebuildValueHistory(user);

        expect(written()).toEqual([{ day: '2020-01-06', totalValue: 8, itemCount: 1 }]);
    });

    it('counts a manual album by its hand-entered value', async () => {
        items.push({ addedAt: new Date(2020, 0, 5, 9), manualValue: 12.5, priceCache: null });

        await rebuildValueHistory(user);

        expect(written()).toEqual([{ day: '2020-01-05', totalValue: 12.5, itemCount: 1 }]);
    });

    it('stamps each snapshot at local midnight of its day, and removes nothing by default', async () => {
        items.push(priced(new Date(2020, 0, 5, 9), 10));

        await rebuildValueHistory(user);

        const [, update] = vi.mocked(ValueSnapshot.findOneAndUpdate).mock.calls[0];
        expect((update as { $set: { capturedAt: Date } }).$set.capturedAt).toEqual(new Date('2020-01-05T00:00:00'));
        expect(ValueSnapshot.deleteMany).not.toHaveBeenCalled();
    });

    describe('with replaceSeeded', () => {
        it('removes the snapshots an earlier rebuild wrote and keeps the measured ones', async () => {
            snapshots.push(
                { _id: 'seeded', day: '2020-01-03', capturedAt: new Date('2020-01-03T00:00:00') },
                { _id: 'measured', day: '2020-01-04', capturedAt: new Date(2020, 0, 4, 7, 31, 12) }
            );
            items.push(priced(new Date(2020, 0, 5, 9), 10));

            await rebuildValueHistory(user, { replaceSeeded: true });

            expect(ValueSnapshot.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['seeded'] } });
        });

        it('does not overwrite a day that was measured', async () => {
            snapshots.push({ _id: 'measured', day: '2020-01-05', capturedAt: new Date(2020, 0, 5, 7, 31, 12) });
            items.push(priced(new Date(2020, 0, 5, 9), 10), priced(new Date(2020, 0, 6, 9), 5));

            expect(await rebuildValueHistory(user, { replaceSeeded: true })).toBe(1);

            expect(written()).toEqual([{ day: '2020-01-06', totalValue: 15, itemCount: 2 }]);
        });

        it('still counts a measured day\'s items in the days after it', async () => {
            snapshots.push({ _id: 'measured', day: '2020-01-05', capturedAt: new Date(2020, 0, 5, 7, 31, 12) });
            items.push(priced(new Date(2020, 0, 5, 9), 10), priced(new Date(2020, 0, 6, 9), 5));

            await rebuildValueHistory(user, { replaceSeeded: true });

            expect(written()[0]).toMatchObject({ itemCount: 2, totalValue: 15 });
        });
    });
});
