import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios');
vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../utils/cover.utils', () => ({
    downloadCoverToLocal: vi.fn(async () => '/uploads/covers/spotify.jpg'),
}));

import { downloadCoverToLocal } from '../utils/cover.utils';
import {
    InvalidSpotifyUrlError,
    MissingSpotifyCredentialsError,
    formatSpotifyDuration,
    importSpotifyAlbum,
    parseSpotifyAlbumId,
} from './spotify.service';

const ALBUM_ID = '50E1iPxp3XKXkykr3F2Kaz';
const ALBUM_URL = `https://open.spotify.com/intl-it/album/${ALBUM_ID}`;

const albumResponse = {
    name: 'Blue Train',
    artists: [{ name: 'John Coltrane' }],
    release_date: '1957-09-15',
    images: [
        { url: 'https://i.scdn.co/image/small', width: 64 },
        { url: 'https://i.scdn.co/image/large', width: 640 },
    ],
    external_urls: { spotify: ALBUM_URL },
    tracks: {
        items: [
            {
                name: 'Blue Train',
                track_number: 1,
                disc_number: 1,
                duration_ms: 632_000,
                artists: [{ name: 'John Coltrane' }],
            },
        ],
        next: 'https://api.spotify.com/v1/albums/some-id/tracks?offset=50&limit=50',
        total: 51,
    },
};

describe('spotify.service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('SPOTIFY_CLIENT_ID', 'client-id');
        vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'client-secret');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('parses localized links, plain links and Spotify URIs', () => {
        expect(parseSpotifyAlbumId(ALBUM_URL)).toBe(ALBUM_ID);
        expect(parseSpotifyAlbumId(`https://open.spotify.com/album/${ALBUM_ID}?si=abc`)).toBe(ALBUM_ID);
        expect(parseSpotifyAlbumId(`spotify:album:${ALBUM_ID}`)).toBe(ALBUM_ID);
    });

    it('rejects links that are not a Spotify album', () => {
        expect(() => parseSpotifyAlbumId('https://open.spotify.com/track/123')).toThrow(InvalidSpotifyUrlError);
        expect(() => parseSpotifyAlbumId('https://example.com/album/123')).toThrow(InvalidSpotifyUrlError);
    });

    it('formats durations as m:ss', () => {
        expect(formatSpotifyDuration(632_000)).toBe('10:32');
        expect(formatSpotifyDuration(61_000)).toBe('1:01');
    });

    it('imports metadata, every track page and the localized cover', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: { access_token: 'token', expires_in: 3600 },
        } as never);
        vi.mocked(axios.get)
            .mockResolvedValueOnce({ data: albumResponse } as never)
            .mockResolvedValueOnce({
                data: {
                    items: [{
                        name: 'I’m Old-Fashioned',
                        track_number: 1,
                        disc_number: 2,
                        duration_ms: 75_000,
                        artists: [{ name: 'John Coltrane' }, { name: 'Someone Else' }],
                    }],
                    next: null,
                    total: 51,
                },
            } as never);

        const imported = await importSpotifyAlbum(ALBUM_URL);

        expect(imported).toMatchObject({
            title: 'Blue Train',
            artist: 'John Coltrane',
            year: '1957',
            coverImage: '/uploads/covers/spotify.jpg',
            spotifyId: ALBUM_ID,
            externalUrl: ALBUM_URL,
        });
        expect(imported.tracklist).toEqual([
            { position: '1', title: 'Blue Train', duration: '10:32', artist: '' },
            { position: '2-1', title: 'I’m Old-Fashioned', duration: '1:15', artist: 'John Coltrane, Someone Else' },
        ]);
        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.get).toHaveBeenCalledTimes(2);
        expect(downloadCoverToLocal).toHaveBeenCalledWith('https://i.scdn.co/image/large', 'Spotify cover');
    });

    it('reports missing credentials before calling Spotify', async () => {
        vi.stubEnv('SPOTIFY_CLIENT_ID', '');
        vi.stubEnv('SPOTIFY_CLIENT_SECRET', '');

        await expect(importSpotifyAlbum(ALBUM_URL)).rejects.toBeInstanceOf(MissingSpotifyCredentialsError);
        expect(axios.post).not.toHaveBeenCalled();
    });
});
