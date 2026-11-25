import { describe, expect, it } from 'vitest';
import { detectIntent } from './searchIntent';

const ALBUM_ID = '50E1iPxp3XKXkykr3F2Kaz';

describe('detectIntent', () => {
    it('recognizes Spotify album links as imports', () => {
        expect(detectIntent(`https://open.spotify.com/intl-it/album/${ALBUM_ID}`)).toEqual({
            kind: 'spotifyUrl',
            value: `https://open.spotify.com/intl-it/album/${ALBUM_ID}`,
        });
        expect(detectIntent(`https://open.spotify.com/album/${ALBUM_ID}?si=abc`).kind).toBe('spotifyUrl');
        expect(detectIntent(`spotify:album:${ALBUM_ID}`).kind).toBe('spotifyUrl');
    });

    it('leaves other Spotify links and plain text as searches', () => {
        expect(detectIntent(`https://open.spotify.com/track/${ALBUM_ID}`).kind).toBe('text');
        expect(detectIntent('Kind of Blue').kind).toBe('text');
    });

    it('still recognizes the existing reference types', () => {
        expect(detectIntent('12345')).toEqual({ kind: 'discogsId', value: '12345' });
        expect(detectIntent('5099923512925')).toEqual({ kind: 'barcode', value: '5099923512925' });
        expect(detectIntent('BLP 1577')).toEqual({ kind: 'catno', value: 'BLP 1577' });
    });
});
