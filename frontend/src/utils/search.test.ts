import { describe, expect, it } from 'vitest';
import { getSearchTermGroups, matchesSearchGroups } from './search';

describe('collection free-text search', () => {
    it('splits the query into accent-free AND groups on OR', () => {
        expect(getSearchTermGroups('miles davis OR kind blue')).toEqual([['miles', 'davis'], ['kind', 'blue']]);
        expect(getSearchTermGroups('or miles or OR davis or')).toEqual([['miles'], ['davis']]);
        expect(getSearchTermGroups('  Björk  AC/DC 59 ')).toEqual([['bjork', 'ac', 'dc', '59']]);
        expect(getSearchTermGroups('   ')).toEqual([]);
    });

    it('matches incomplete words, even when they are in different fields', () => {
        const fields = ['Miles Davis', 'Kind of Blue', 'Hard Bop', 'Columbia', 'BLP 1577'];

        expect(matchesSearchGroups(getSearchTermGroups('miles davis kind blue'), fields)).toBe(true);
        expect(matchesSearchGroups(getSearchTermGroups('mil dav-kind blu'), fields)).toBe(true);
        expect(matchesSearchGroups(getSearchTermGroups('davis hard'), fields)).toBe(true);
        expect(matchesSearchGroups(getSearchTermGroups('columbia 1577'), fields)).toBe(true);
    });

    it('requires every word of a group to match somewhere', () => {
        const fields = ['Miles Davis', 'Kind of Blue'];

        expect(matchesSearchGroups(getSearchTermGroups('miles beatles'), fields)).toBe(false);
        expect(matchesSearchGroups(getSearchTermGroups('kind missing'), fields)).toBe(false);
    });

    it('matches when any of the OR groups matches', () => {
        const fields = ['Miles Davis', 'Kind of Blue'];

        expect(matchesSearchGroups(getSearchTermGroups('miles davis OR beatles'), fields)).toBe(true);
        expect(matchesSearchGroups(getSearchTermGroups('miles or abbey'), fields)).toBe(true);
        expect(matchesSearchGroups(getSearchTermGroups('miles beatles OR kind blue'), fields)).toBe(true);
        expect(matchesSearchGroups(getSearchTermGroups('miles beatles OR xyz missing'), fields)).toBe(false);
    });

    it('accepts an empty query and ignores punctuation differences', () => {
        expect(matchesSearchGroups([], [])).toBe(true);
        expect(matchesSearchGroups(getSearchTermGroups('acdc'), ['AC/DC'])).toBe(true);
        expect(matchesSearchGroups(getSearchTermGroups('bjork'), ['Björk'])).toBe(true);
    });

    it('ignores empty fields', () => {
        expect(matchesSearchGroups(getSearchTermGroups('jazz'), [undefined, null, '', 'Jazz'])).toBe(true);
        expect(matchesSearchGroups(getSearchTermGroups('rock'), [undefined, null, ''])).toBe(false);
    });
});
