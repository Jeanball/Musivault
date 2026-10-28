import { describe, expect, it } from 'vitest';
import { resolveMemberStyles, toMusicBrainzStyles } from './collection.service';

describe('resolveMemberStyles', () => {
    it('adds followed styles to the collection ones', () => {
        expect(resolveMemberStyles(['Rock'], ['jazz'])).toEqual(['Rock', 'jazz']);
    });

    it('works for a member with an empty collection who follows styles', () => {
        expect(resolveMemberStyles([], ['jazz'])).toEqual(['jazz']);
    });

    it('drops excluded styles whatever their casing, followed ones included', () => {
        expect(resolveMemberStyles(['Hard Rock', 'Jazz'], ['jazz', 'funk'], ['hard rock', 'Funk'])).toEqual(['Jazz']);
    });

    it('keeps one spelling of a style present in both lists', () => {
        expect(resolveMemberStyles(['Jazz'], ['jazz'])).toEqual(['Jazz']);
    });
});

describe('toMusicBrainzStyles', () => {
    it('lowercases and dedupes', () => {
        expect(toMusicBrainzStyles(['Jazz', 'jazz', 'Hard Rock'])).toEqual(['hard rock', 'jazz']);
    });
});
