import { describe, expect, it } from 'vitest';
import { DISCOGS_STYLES } from '../constants/discogsGenres';
import { getStylesForGenres, isDiscogsStyle, pruneStylesForGenres } from './discogsTags';

describe('discogsTags', () => {
    it('offers every style until a genre is chosen', () => {
        expect(getStylesForGenres([])).toEqual(DISCOGS_STYLES);
    });

    it('restricts styles to the chosen genre', () => {
        const jazzStyles = getStylesForGenres(['Jazz']);

        expect(jazzStyles.length).toBeGreaterThan(0);
        expect(jazzStyles.length).toBeLessThan(DISCOGS_STYLES.length);
        expect(jazzStyles).toContain('Hard Bop');
        expect(jazzStyles).not.toContain('Black Metal');
    });

    it('unions the styles of several genres without duplicates', () => {
        const jazz = getStylesForGenres(['Jazz']);
        const rock = getStylesForGenres(['Rock']);
        const both = getStylesForGenres(['Jazz', 'Rock']);

        expect(new Set(both).size).toBe(both.length);
        expect([...both].sort()).toEqual([...new Set([...jazz, ...rock])].sort());
    });

    it('drops styles that no longer fit the genres, but keeps non-Discogs values', () => {
        expect(
            pruneStylesForGenres(['Hard Bop', 'Black Metal', 'Private Press'], ['Rock'])
        ).toEqual(['Black Metal', 'Private Press']);
        expect(pruneStylesForGenres(['Hard Bop'], [])).toEqual(['Hard Bop']);
        expect(isDiscogsStyle('Hard Bop')).toBe(true);
        expect(isDiscogsStyle('Private Press')).toBe(false);
    });

    it('has a style-bounded mapping for every Discogs genre', async () => {
        const { DISCOGS_GENRES, DISCOGS_STYLES_BY_GENRE } = await import('../constants/discogsGenres');

        for (const genre of DISCOGS_GENRES) {
            const styles = DISCOGS_STYLES_BY_GENRE[genre];
            expect(styles, genre).toBeDefined();
            expect(styles.length, genre).toBeGreaterThan(0);
            expect(styles.length, genre).toBeLessThan(DISCOGS_STYLES.length);
            for (const style of styles) expect(isDiscogsStyle(style)).toBe(true);
        }
    });
});
