import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';

const { coversDir } = vi.hoisted(() => ({
    // Kept outside the repository so a failed test run cannot leave files behind.
    coversDir: `${process.env.TEMP || '/tmp'}/musivault-covers-test`
}));

vi.mock('../config/uploads.config', () => ({ COVERS_DIR: coversDir }));
vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('axios', () => ({ default: { get: vi.fn() } }));

import axios from 'axios';
import {
    decodeBase64Cover,
    detectImageType,
    downloadCoverToLocal,
    localCoverToDataUri,
    saveCoverFromBase64,
    toDataUri
} from './cover.utils';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpeg-body')]);
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('png-body')
]);
const webp = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
    Buffer.from('webp-body')
]);

describe('cover.utils', () => {
    beforeEach(() => {
        fs.rmSync(coversDir, { recursive: true, force: true });
    });

    afterAll(() => {
        fs.rmSync(coversDir, { recursive: true, force: true });
    });

    it('detects the image type from the magic bytes', () => {
        expect(detectImageType(jpeg)).toEqual({ mime: 'image/jpeg', ext: '.jpg' });
        expect(detectImageType(png)).toEqual({ mime: 'image/png', ext: '.png' });
        expect(detectImageType(webp)).toEqual({ mime: 'image/webp', ext: '.webp' });
        expect(detectImageType(Buffer.from('not an image'))).toBeNull();
    });

    it('decodes both a data URI and a bare base64 string', () => {
        const dataUri = toDataUri(png, { mime: 'image/png', ext: '.png' });
        expect(dataUri.startsWith('data:image/png;base64,')).toBe(true);
        expect(decodeBase64Cover(dataUri)?.equals(png)).toBe(true);
        expect(decodeBase64Cover(jpeg.toString('base64'))?.equals(jpeg)).toBe(true);
        expect(decodeBase64Cover('')).toBeNull();
        expect(decodeBase64Cover('not base64 at all!')).toBeNull();
    });

    it('writes a cover and returns its public path', async () => {
        const coverPath = await saveCoverFromBase64(`data:image/webp;base64,${webp.toString('base64')}`);

        expect(coverPath).toMatch(/^\/uploads\/covers\/.+-[0-9]+\.webp$/);
        const filename = coverPath!.split('/').pop()!;
        expect(fs.readFileSync(`${coversDir}/${filename}`).equals(webp)).toBe(true);
    });

    it('rejects data that is not a supported image or is too large', async () => {
        expect(await saveCoverFromBase64('hello')).toBeNull();
        expect(await saveCoverFromBase64(Buffer.from('text').toString('base64'))).toBeNull();

        const oversized = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]);
        expect(await saveCoverFromBase64(oversized.toString('base64'))).toBeNull();
        expect(fs.existsSync(coversDir)).toBe(false);
    });

    it('exports a locally stored cover and ignores remote URLs', async () => {
        const coverPath = await saveCoverFromBase64(jpeg.toString('base64'));
        const dataUri = await localCoverToDataUri(coverPath);

        expect(dataUri).toBe(`data:image/jpeg;base64,${jpeg.toString('base64')}`);
        expect(await localCoverToDataUri('https://img.discogs.com/cover.jpg')).toBeNull();
        expect(await localCoverToDataUri('/uploads/covers/missing.jpg')).toBeNull();
    });

    it('copies a remote Discogs cover into the local covers directory', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) });

        const coverPath = await downloadCoverToLocal('https://img.discogs.com/release.png');

        expect(axios.get).toHaveBeenCalledWith(
            'https://img.discogs.com/release.png',
            expect.objectContaining({ responseType: 'arraybuffer' })
        );
        expect(coverPath).toMatch(/^\/uploads\/covers\/.+-[0-9]+\.png$/);
        const filename = coverPath.split('/').pop()!;
        expect(fs.readFileSync(`${coversDir}/${filename}`).equals(png)).toBe(true);
    });

    it('keeps the remote URL when the download or the image check fails', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('network down'));
        expect(await downloadCoverToLocal('https://img.discogs.com/cover.jpg')).toBe('https://img.discogs.com/cover.jpg');

        vi.mocked(axios.get).mockResolvedValue({ data: Buffer.from('not an image').buffer });
        expect(await downloadCoverToLocal('https://img.discogs.com/cover.jpg')).toBe('https://img.discogs.com/cover.jpg');
    });

    it('leaves local paths and empty covers untouched', async () => {
        vi.mocked(axios.get).mockClear();

        expect(await downloadCoverToLocal('/uploads/covers/already.jpg')).toBe('/uploads/covers/already.jpg');
        expect(await downloadCoverToLocal('')).toBe('');
        expect(await downloadCoverToLocal(null)).toBe('');
        expect(axios.get).not.toHaveBeenCalled();
    });
});
