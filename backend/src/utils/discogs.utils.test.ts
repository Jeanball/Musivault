import { describe, expect, it } from 'vitest';
import { parseDiscogsCondition } from './discogs.utils';

describe('parseDiscogsCondition', () => {
    it.each([
        ['Mint (M)', 'M'],
        ['Near Mint (NM or M-)', 'NM'],
        ['Very Good Plus (VG+)', 'VG+'],
        ['Very Good (VG)', 'VG'],
        ['Good Plus (G+)', 'G+'],
        ['Good (G)', 'G'],
        ['Fair (F)', 'F'],
        ['Poor (P)', 'P']
    ])('maps "%s" to %s', (value, code) => {
        expect(parseDiscogsCondition(value)).toBe(code);
    });

    it('returns undefined for an empty or missing value', () => {
        expect(parseDiscogsCondition(undefined)).toBeUndefined();
        expect(parseDiscogsCondition('')).toBeUndefined();
    });

    it('returns undefined for a grade it does not know', () => {
        expect(parseDiscogsCondition('Sealed (SEALED)')).toBeUndefined();
        expect(parseDiscogsCondition('Whatever')).toBeUndefined();
    });

    it('keeps the sleeve-only values for a sleeve, and drops them for the media', () => {
        expect(parseDiscogsCondition('Generic', { sleeve: true })).toBe('Generic');
        expect(parseDiscogsCondition('Not Graded', { sleeve: true })).toBe('Not Graded');
        expect(parseDiscogsCondition('No Cover', { sleeve: true })).toBe('No Cover');
        expect(parseDiscogsCondition('No Cover')).toBeUndefined();
    });

    it('still maps ordinary grades for a sleeve', () => {
        expect(parseDiscogsCondition('Very Good Plus (VG+)', { sleeve: true })).toBe('VG+');
    });
});
