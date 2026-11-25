import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/spotify.service', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/spotify.service')>();
    return { ...actual, importSpotifyAlbum: vi.fn() };
});

import { getSpotifyAlbum } from './spotify.controller';
import {
    InvalidSpotifyUrlError,
    MissingSpotifyCredentialsError,
    SpotifyAlbumNotFoundError,
    importSpotifyAlbum,
} from '../services/spotify.service';

const ALBUM_ID = '50E1iPxp3XKXkykr3F2Kaz';
const ALBUM_URL = `https://open.spotify.com/album/${ALBUM_ID}`;

function respond(query: Record<string, unknown>) {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
    };
    return { res, request: { query } as unknown as Request };
}

describe('getSpotifyAlbum', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the imported album for a pasted URL', async () => {
        const album = { title: 'Blue Train', spotifyId: ALBUM_ID };
        vi.mocked(importSpotifyAlbum).mockResolvedValue(album as never);
        const { request, res } = respond({ url: ALBUM_URL });

        await getSpotifyAlbum(request, res as unknown as Response);

        expect(importSpotifyAlbum).toHaveBeenCalledWith(ALBUM_URL);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(album);
    });

    it('accepts an already parsed id', async () => {
        vi.mocked(importSpotifyAlbum).mockResolvedValue({} as never);
        const { request, res } = respond({ id: ALBUM_ID });

        await getSpotifyAlbum(request, res as unknown as Response);

        expect(importSpotifyAlbum).toHaveBeenCalledWith(`spotify:album:${ALBUM_ID}`);
    });

    it('rejects a missing URL', async () => {
        const { request, res } = respond({});

        await getSpotifyAlbum(request, res as unknown as Response);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(importSpotifyAlbum).not.toHaveBeenCalled();
    });

    it('passes through the known error statuses', async () => {
        const cases = [
            [new InvalidSpotifyUrlError(), 400],
            [new MissingSpotifyCredentialsError(), 503],
            [new SpotifyAlbumNotFoundError(ALBUM_ID), 404],
        ] as const;

        for (const [error, status] of cases) {
            vi.mocked(importSpotifyAlbum).mockRejectedValueOnce(error);
            const { request, res } = respond({ url: ALBUM_URL });
            await getSpotifyAlbum(request, res as unknown as Response);
            expect(res.status).toHaveBeenCalledWith(status);
        }
    });

    it('does not leak unexpected errors', async () => {
        vi.mocked(importSpotifyAlbum).mockRejectedValueOnce(new Error('token endpoint exploded'));
        const { request, res } = respond({ url: ALBUM_URL });

        await getSpotifyAlbum(request, res as unknown as Response);

        expect(res.status).toHaveBeenCalledWith(502);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Could not import the album from Spotify. Please try again.',
        });
    });
});
