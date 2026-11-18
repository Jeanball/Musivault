import { describe, it, expect } from 'vitest';
import { artistSortKey, compareArtistNames } from './artistSort';

const sorted = (names: string[], ignoreLeadingArticle: boolean): string[] =>
    [...names].sort((a, b) => compareArtistNames(a, b, ignoreLeadingArticle));

describe('artistSortKey', () => {
    it('drops a leading article when asked', () => {
        expect(artistSortKey('The Beatles', true)).toBe('beatles');
        expect(artistSortKey('A Tribe Called Quest', true)).toBe('tribe called quest');
        expect(artistSortKey('An Horse', true)).toBe('horse');
    });

    it('keeps the article when the preference is off', () => {
        expect(artistSortKey('The Beatles', false)).toBe('the beatles');
    });

    it('reproduces the plain lower-cased name when the preference is off', () => {
        const names = ['The Beatles', 'Blur', 'Tame Impala', 'ABBA'];
        expect(sorted(names, false)).toEqual(
            [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        );
    });

    it('only strips an article that is a whole word', () => {
        expect(artistSortKey('Theatre of Hate', true)).toBe('theatre of hate');
        expect(artistSortKey('Anal Cunt', true)).toBe('anal cunt');
    });

    it('never reduces a name to an empty key', () => {
        expect(artistSortKey('The', true)).toBe('the');
        expect(artistSortKey('A', true)).toBe('a');
        expect(artistSortKey('The ', true)).toBe('the ');
    });
});

describe('compareArtistNames', () => {
    it('files "The Beatles" under B when enabled', () => {
        expect(sorted(['Blur', 'The Beatles', 'Beach Boys'], true)).toEqual([
            'Beach Boys',
            'The Beatles',
            'Blur',
        ]);
    });

    it('files "The Beatles" under T when disabled', () => {
        expect(sorted(['Blur', 'The Beatles', 'Tame Impala'], false)).toEqual([
            'Blur',
            'Tame Impala',
            'The Beatles',
        ]);
    });

    it('files "A Tribe Called Quest" under T and "An Horse" under H', () => {
        expect(sorted(['Interpol', 'A Tribe Called Quest', 'An Horse'], true)).toEqual([
            'An Horse',
            'Interpol',
            'A Tribe Called Quest',
        ]);
    });
});
