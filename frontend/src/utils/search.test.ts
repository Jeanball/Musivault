import { describe, expect, it } from 'vitest';
import { getSearchTerms, matchesSearchTerms } from './search';

describe('collection free-text search', () => {
    it('splits a query into accent-free words', () => {
        expect(getSearchTerms('  Björk  AC/DC 59 ')).toEqual(['bjork', 'ac', 'dc', '59']);
        expect(getSearchTerms('   ')).toEqual([]);
    });

    it('matches incomplete words, even when they are in different fields', () => {
        const fields = ['Miles Davis', 'Kind of Blue', 'Hard Bop', 'Columbia', 'BLP 1577'];

        expect(matchesSearchTerms(getSearchTerms('miles davis kind blue'), fields)).toBe(true);
        expect(matchesSearchTerms(getSearchTerms('mil dav-kind blu'), fields)).toBe(true);
        expect(matchesSearchTerms(getSearchTerms('davis hard'), fields)).toBe(true);
        expect(matchesSearchTerms(getSearchTerms('columbia 1577'), fields)).toBe(true);
    });

    it('requires every word to match somewhere', () => {
        const fields = ['Miles Davis', 'Kind of Blue'];

        expect(matchesSearchTerms(getSearchTerms('miles beatles'), fields)).toBe(false);
        expect(matchesSearchTerms(getSearchTerms('kind missing'), fields)).toBe(false);
    });

    it('accepts an empty query and ignores punctuation differences', () => {
        expect(matchesSearchTerms([], [])).toBe(true);
        expect(matchesSearchTerms(getSearchTerms('acdc'), ['AC/DC'])).toBe(true);
        expect(matchesSearchTerms(getSearchTerms('bjork'), ['Björk'])).toBe(true);
    });

    it('ignores empty fields', () => {
        expect(matchesSearchTerms(getSearchTerms('jazz'), [undefined, null, '', 'Jazz'])).toBe(true);
        expect(matchesSearchTerms(getSearchTerms('rock'), [undefined, null, ''])).toBe(false);
    });
});
