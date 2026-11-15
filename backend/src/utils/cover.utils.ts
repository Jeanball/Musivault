import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { COVERS_DIR } from '../config/uploads.config';
import { logger } from '../config/logger.config';
import { DISCOGS_HEADERS } from './discogs.utils';

/** Same limit the cover upload endpoint enforces. */
export const MAX_COVER_BYTES = 5 * 1024 * 1024;

export interface ImageType {
    mime: string;
    ext: string;
}

const JPEG: ImageType = { mime: 'image/jpeg', ext: '.jpg' };
const PNG: ImageType = { mime: 'image/png', ext: '.png' };
const WEBP: ImageType = { mime: 'image/webp', ext: '.webp' };

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Identify an image from its magic bytes. The declared mime type is not
 * trusted, because a CSV cell is free text.
 */
export function detectImageType(buffer: Buffer): ImageType | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return JPEG;
    }
    if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        return PNG;
    }
    if (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return WEBP;
    }
    return null;
}

/** Encode an image as a data URI, the form the CSV export writes. */
export function toDataUri(buffer: Buffer, type: ImageType): string {
    return `data:${type.mime};base64,${buffer.toString('base64')}`;
}

/**
 * Decode a cover cell. Both a full data URI (`data:image/png;base64,...`) and
 * a bare base64 string are accepted; anything that is not base64 is rejected
 * rather than written out as a file.
 */
export function decodeBase64Cover(raw: string | null | undefined): Buffer | null {
    const text = raw?.trim();
    if (!text) return null;

    const payload = text.replace(/^data:[^,]*,/i, '').replace(/\s+/g, '');
    if (!payload || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return null;

    const buffer = Buffer.from(payload, 'base64');
    return buffer.length ? buffer : null;
}

/**
 * Read a locally stored cover and return its data URI. Only files under
 * `/uploads/covers/` qualify: Discogs covers are remote URLs and are not
 * downloaded during the export.
 */
export async function localCoverToDataUri(coverPath: string | null | undefined): Promise<string | null> {
    if (!coverPath || !coverPath.startsWith('/uploads/covers/')) return null;

    try {
        const filename = path.basename(coverPath);
        const buffer = await fs.promises.readFile(path.join(COVERS_DIR, filename));
        const type = detectImageType(buffer);
        if (!type) {
            logger.warn({ coverPath }, '[Export] Local cover is not a supported image');
            return null;
        }
        return toDataUri(buffer, type);
    } catch (err) {
        logger.warn({ err, coverPath }, '[Export] Could not read the local cover');
        return null;
    }
}

/**
 * Write an image under the covers directory with a unique name and return its
 * public path.
 */
async function writeCoverFile(buffer: Buffer, type: ImageType): Promise<string> {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${type.ext}`;
    await fs.promises.mkdir(COVERS_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(COVERS_DIR, filename), buffer);
    return `/uploads/covers/${filename}`;
}

/**
 * Write an image from a base64/data-URI CSV cell under the covers directory and
 * return the public path, or null when the cell is not a usable cover (empty,
 * not base64, not JPEG/PNG/WebP, or larger than the upload limit).
 */
export async function saveCoverFromBase64(raw: string | null | undefined): Promise<string | null> {
    const buffer = decodeBase64Cover(raw);
    if (!buffer) return null;

    if (buffer.length > MAX_COVER_BYTES) {
        logger.warn({ size: buffer.length }, '[Import] Cover image is larger than the 5 MB limit');
        return null;
    }

    const type = detectImageType(buffer);
    if (!type) {
        logger.warn('[Import] Cover data is not a JPEG, PNG or WebP image');
        return null;
    }

    return writeCoverFile(buffer, type);
}

/**
 * Copy a remote image (a Discogs cover) into the local covers directory and
 * return the path to serve it from. Anything that is not a remote http(s) URL is
 * returned untouched, and so is the original URL when the download or the image
 * check fails: a missing cover must never block adding an album.
 */
export async function downloadCoverToLocal(
    url: string | null | undefined,
    label = 'cover'
): Promise<string> {
    const value = typeof url === 'string' ? url.trim() : '';
    if (!value) return '';
    if (value.startsWith('/uploads/covers/')) return value;
    if (!/^https?:\/\//i.test(value)) return value;

    try {
        const response = await axios.get<ArrayBuffer>(value, {
            responseType: 'arraybuffer',
            // The image CDN answers 403 to the default axios user agent.
            headers: DISCOGS_HEADERS,
            timeout: 15000,
            maxContentLength: MAX_COVER_BYTES,
            maxBodyLength: MAX_COVER_BYTES
        });

        const buffer = Buffer.from(response.data);
        if (!buffer.length) return value;
        if (buffer.length > MAX_COVER_BYTES) {
            logger.warn({ url: value, size: buffer.length }, `[Cover] ${label} is larger than the 5 MB limit`);
            return value;
        }

        const type = detectImageType(buffer);
        if (!type) {
            logger.warn({ url: value }, `[Cover] ${label} is not a JPEG, PNG or WebP image`);
            return value;
        }

        return await writeCoverFile(buffer, type);
    } catch (err) {
        logger.warn({ err, url: value }, `[Cover] Could not download the ${label}; keeping the remote URL`);
        return value;
    }
}
