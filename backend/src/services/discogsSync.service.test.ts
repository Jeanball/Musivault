import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { compareCollections, ComparableItem } from './discogsSync.service';
import type { DiscogsCollectionRelease } from '../types/discogs.types';

let nextInstance = 1000;

function entry(
    id: number,
    overrides: Partial<{
        artist: string;
        title: string;
        year: number;
        format: string;
        dateAdded: string;
        instanceId: number;
    }> = {}
): DiscogsCollectionRelease {
    return {
        id,
        instance_id: overrides.instanceId ?? nextInstance++,
        date_added: overrides.dateAdded ?? '2020-05-01T12:00:00-07:00',
        basic_information: {
            id,
            title: overrides.title ?? `Title ${id}`,
            year: overrides.year ?? 1990,
            thumb: `https://img/${id}.jpg`,
            artists: [{ name: overrides.artist ?? `Artist ${id}` }],
            formats: [{ name: overrides.format ?? 'Vinyl' }]
        }
    };
}

function item(overrides: Partial<ComparableItem> = {}): ComparableItem {
    return {
        itemId: new mongoose.Types.ObjectId(),
        artist: 'Some Artist',
        title: 'Some Title',
        year: '1990',
        format: 'Vinyl',
        addedAt: new Date('2020-05-01T19:00:00Z'),
        ...overrides
    };
}

describe('compareCollections', () => {
    it('returns an empty result for two empty collections', () => {
        expect(compareCollections([], [])).toEqual({
            matched: 0,
            dateDiffers: 0,
            matchedItems: [],
            newOnDiscogs: [],
            merged: [],
            onlyInMusivault: []
        });
    });

    describe('matching on release id', () => {
        it('matches an item whose album has the release id', () => {
            const result = compareCollections([entry(1)], [item({ discogsId: 1 })]);
            expect(result.matched).toBe(1);
            expect(result.newOnDiscogs).toEqual([]);
            expect(result.onlyInMusivault).toEqual([]);
        });

        it('ignores the format: an LP item matches a release Discogs lists as a CD', () => {
            const result = compareCollections([entry(1, { format: 'CD' })], [item({ discogsId: 1, format: 'Vinyl' })]);
            expect(result.matched).toBe(1);
            expect(result.newOnDiscogs).toEqual([]);
        });

        it('keeps an LP and a CD release of the same album apart', () => {
            const result = compareCollections(
                [entry(1, { format: 'Vinyl' }), entry(2, { format: 'CD' })],
                [item({ discogsId: 1 })]
            );
            expect(result.matched).toBe(1);
            expect(result.newOnDiscogs.map(r => r.releaseId)).toEqual([2]);
        });

        it('counts several Discogs copies of one release once', () => {
            const result = compareCollections([entry(1), entry(1), entry(1)], [item({ discogsId: 1 })]);
            expect(result.matched).toBe(1);
            expect(result.newOnDiscogs).toEqual([]);
        });

        it('reports a release with several copies only once as new', () => {
            const result = compareCollections([entry(1), entry(1)], []);
            expect(result.newOnDiscogs).toHaveLength(1);
        });

        it('treats an item without a Discogs id as only in Musivault', () => {
            const manual = item({ discogsId: undefined, artist: 'Nobody', title: 'Demo tape' });
            const result = compareCollections([entry(1)], [manual]);
            expect(result.matched).toBe(0);
            expect(result.onlyInMusivault).toHaveLength(1);
            expect(result.newOnDiscogs.map(r => r.releaseId)).toEqual([1]);
        });
    });

    describe('dates', () => {
        const discogsDate = '2018-02-25T15:25:00-08:00';

        it('counts a matched item whose added date is more than a day from Discogs', () => {
            const result = compareCollections(
                [entry(1, { dateAdded: discogsDate })],
                [item({ discogsId: 1, addedAt: new Date('2026-09-01T10:00:00Z') })]
            );
            expect(result.dateDiffers).toBe(1);
        });

        it('allows up to a day of difference', () => {
            const added = new Date('2018-02-25T23:25:00Z');
            const result = compareCollections(
                [entry(1, { dateAdded: discogsDate })],
                [item({ discogsId: 1, addedAt: new Date(added.getTime() + 23 * 3600 * 1000) })]
            );
            expect(result.dateDiffers).toBe(0);
        });

        it('compares with the earliest Discogs copy', () => {
            const result = compareCollections(
                [entry(1, { dateAdded: '2022-01-01T00:00:00Z' }), entry(1, { dateAdded: '2018-01-01T00:00:00Z' })],
                [item({ discogsId: 1, addedAt: new Date('2018-01-01T05:00:00Z') })]
            );
            expect(result.dateDiffers).toBe(0);
        });

        it('does not count dates of items that are not matched', () => {
            const result = compareCollections([], [item({ discogsId: 9, addedAt: new Date('2026-01-01') })]);
            expect(result.dateDiffers).toBe(0);
        });
    });

    describe('merged releases (a guess)', () => {
        it('pairs an unmatched item with a new Discogs entry of the same artist, title, format and year', () => {
            const old = item({ discogsId: 8499267, artist: 'Obituary', title: 'Cause Of Death', year: '1990', format: 'Vinyl' });
            const survivor = entry(2467355, { artist: 'Obituary', title: 'Cause Of Death', year: 1990, format: 'Vinyl' });

            const result = compareCollections([survivor], [old]);

            expect(result.merged).toHaveLength(1);
            expect(result.merged[0].item.itemId).toBe(old.itemId);
            expect(result.merged[0].item).not.toHaveProperty('addedAt');
            expect(result.merged[0].release).toMatchObject({ releaseId: 2467355, instanceId: survivor.instance_id });
            expect(result.newOnDiscogs).toEqual([]);
            expect(result.onlyInMusivault).toEqual([]);
        });

        it('ignores case, punctuation and the "(n)" artist suffix when pairing', () => {
            const old = item({ discogsId: 5, artist: 'Bane', title: 'Give Blood!' });
            const survivor = entry(6, { artist: 'Bane (2)', title: 'give blood' });
            const result = compareCollections([survivor], [old]);
            expect(result.merged).toHaveLength(1);
            expect(result.merged[0].release.artist).toBe('Bane');
        });

        it('does not pair across formats: a cassette is not the vinyl copy of the album', () => {
            const old = item({ discogsId: 5, format: 'Vinyl' });
            const other = entry(6, { artist: 'Some Artist', title: 'Some Title', format: 'Cassette' });
            const result = compareCollections([other], [old]);
            expect(result.merged).toEqual([]);
            expect(result.onlyInMusivault).toHaveLength(1);
            expect(result.newOnDiscogs.map(r => r.releaseId)).toEqual([6]);
        });

        it('does not pair when both years are known and differ', () => {
            const old = item({ discogsId: 5, year: '1990' });
            const other = entry(6, { artist: 'Some Artist', title: 'Some Title', year: 2005 });
            expect(compareCollections([other], [old]).merged).toEqual([]);
        });

        it('pairs when either year is unknown', () => {
            const noYear = item({ discogsId: 5, year: undefined });
            const zeroYear = entry(6, { artist: 'Some Artist', title: 'Some Title', year: 0 });
            expect(compareCollections([zeroYear], [noYear]).merged).toHaveLength(1);
        });

        it('pairs an item with no format with any format', () => {
            const old = item({ discogsId: 5, format: undefined });
            const other = entry(6, { artist: 'Some Artist', title: 'Some Title', format: 'CD' });
            expect(compareCollections([other], [old]).merged).toHaveLength(1);
        });

        it('uses each Discogs entry at most once', () => {
            const a = item({ discogsId: 5 });
            const b = item({ discogsId: 7 });
            const survivor = entry(6, { artist: 'Some Artist', title: 'Some Title' });
            const result = compareCollections([survivor], [a, b]);
            expect(result.merged).toHaveLength(1);
            expect(result.merged[0].item.itemId).toBe(a.itemId);
            expect(result.onlyInMusivault.map(i => i.itemId)).toEqual([b.itemId]);
        });

        it('never pairs with a release that another item already matches', () => {
            const owned = item({ discogsId: 6 });
            const stray = item({ discogsId: 5 });
            const result = compareCollections([entry(6, { artist: 'Some Artist', title: 'Some Title' })], [owned, stray]);
            expect(result.matched).toBe(1);
            expect(result.merged).toEqual([]);
            expect(result.onlyInMusivault.map(i => i.itemId)).toEqual([stray.itemId]);
        });
    });

    describe('matching order: release id, then instance id, then the guess', () => {
        it('matches by release id even when the stored instance id now sits under another release', () => {
            const owner = item({ discogsId: 1, instanceId: 500 });
            const result = compareCollections([entry(1, { instanceId: 11 }), entry(2, { instanceId: 500 })], [owner]);
            expect(result.matched).toBe(1);
            expect(result.merged).toEqual([]);
            expect(result.newOnDiscogs.map(r => r.releaseId)).toEqual([2]);
        });

        it('finds a merge by the stored instance id and calls it exact', () => {
            const old = item({ discogsId: 8499267, instanceId: 282517317, artist: 'Obituary', title: 'Cause Of Death' });
            const survivor = entry(2467355, { instanceId: 282517317, artist: 'Obituary', title: 'Cause Of Death' });

            const result = compareCollections([survivor], [old]);

            expect(result.merged).toHaveLength(1);
            expect(result.merged[0]).toMatchObject({ match: 'instance', release: { releaseId: 2467355, instanceId: 282517317 } });
            expect(result.newOnDiscogs).toEqual([]);
        });

        it('finds an exact merge even when artist, title, format and year all changed', () => {
            const old = item({ discogsId: 5, instanceId: 77, artist: 'Old Name', title: 'Old Title', format: 'Vinyl', year: '1980' });
            const survivor = entry(6, { instanceId: 77, artist: 'New Name', title: 'New Title', year: 2001, format: 'CD' });

            expect(compareCollections([survivor], [old]).merged[0].match).toBe('instance');
        });

        it('prefers the instance id to a look-alike with the same artist and title', () => {
            const old = item({ discogsId: 5, instanceId: 77 });
            const lookAlike = entry(8, { instanceId: 88, artist: 'Some Artist', title: 'Some Title' });
            const moved = entry(6, { instanceId: 77, artist: 'Other', title: 'Other' });

            const result = compareCollections([lookAlike, moved], [old]);

            expect(result.merged).toHaveLength(1);
            expect(result.merged[0].release.releaseId).toBe(6);
            expect(result.newOnDiscogs.map(r => r.releaseId)).toEqual([8]);
        });

        it('falls back to the guess, marked as one, for an item without an instance id', () => {
            const old = item({ discogsId: 5 });
            const survivor = entry(6, { artist: 'Some Artist', title: 'Some Title' });

            expect(compareCollections([survivor], [old]).merged[0].match).toBe('guess');
        });

        it('falls back to the guess when the stored instance id is no longer on Discogs', () => {
            const old = item({ discogsId: 5, instanceId: 404 });
            const survivor = entry(6, { instanceId: 66, artist: 'Some Artist', title: 'Some Title' });

            expect(compareCollections([survivor], [old]).merged[0]).toMatchObject({ match: 'guess', release: { releaseId: 6 } });
        });

        it('does not merge into a release another item already owns', () => {
            const owner = item({ discogsId: 6 });
            const old = item({ discogsId: 5, instanceId: 66 });

            const result = compareCollections([entry(6, { instanceId: 66 })], [owner, old]);

            expect(result.merged).toEqual([]);
            expect(result.onlyInMusivault.map(i => i.itemId)).toEqual([old.itemId]);
        });

        it('lets only one item claim a Discogs entry', () => {
            const first = item({ discogsId: 5, instanceId: 66 });
            const second = item({ discogsId: 7, instanceId: 66 });

            const result = compareCollections([entry(6, { instanceId: 66 })], [first, second]);

            expect(result.merged.map(m => m.item.itemId)).toEqual([first.itemId]);
            expect(result.onlyInMusivault.map(i => i.itemId)).toEqual([second.itemId]);
        });

        it('keeps the stored instance id and added date out of the report rows', () => {
            const old = item({ discogsId: 5, instanceId: 66 });
            const [merged] = compareCollections([entry(6, { instanceId: 66 })], [old]).merged;
            expect(merged.item).not.toHaveProperty('instanceId');
            expect(merged.item).not.toHaveProperty('addedAt');
        });
    });

    describe('matched items', () => {
        it('lists each matched item with the earliest Discogs copy of its release', () => {
            const owner = item({ discogsId: 1 });
            const result = compareCollections(
                [entry(1, { instanceId: 12, dateAdded: '2021-01-01T00:00:00Z' }), entry(1, { instanceId: 11, dateAdded: '2019-01-01T00:00:00Z' })],
                [owner]
            );
            expect(result.matchedItems).toHaveLength(1);
            expect(result.matchedItems[0].itemId).toBe(owner.itemId);
            expect(result.matchedItems[0].release).toMatchObject({ releaseId: 1, instanceId: 11, dateAdded: new Date('2019-01-01T00:00:00Z') });
        });
    });
});
