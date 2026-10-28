import { describe, expect, it } from 'vitest';
import { buildStyleWindowQuery, quoteLuceneTerm } from './musicbrainz.service';

describe('buildStyleWindowQuery', () => {
    it('quotes multi-word styles so they match as one tag', () => {
        expect(buildStyleWindowQuery('Hard Rock', '2026-10-01', '2026-12-01')).toBe(
            'artisttag:"hard rock" AND firstreleasedate:[2026-10-01 TO 2026-12-01]'
        );
    });

    it('escapes quotes and backslashes in a followed style', () => {
        expect(quoteLuceneTerm('a"b\\c')).toBe('"a\\"b\\\\c"');
    });
});
