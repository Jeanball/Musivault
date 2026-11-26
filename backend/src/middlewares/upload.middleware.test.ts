import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

const { coversDir } = vi.hoisted(() => ({ coversDir: `${process.env.TMPDIR || '/tmp'}/musivault-covers-test-${process.pid}` }));

vi.mock('../config/uploads.config', () => ({ COVERS_DIR: coversDir }));
vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { csvUpload, uploadCover } from './upload.middleware';

// These tests run the real Express + multer stack over HTTP. A mocked request
// would not notice a multer or Express upgrade changing how multipart bodies,
// size limits and error codes behave.
let server: Server;
let base: string;

beforeAll(async () => {
    fs.mkdirSync(coversDir, { recursive: true });
    const app = express();
    app.post('/cover', uploadCover, (req, res) => {
        res.status(201).json({ filename: req.file?.filename, size: req.file?.size, fields: req.body });
    });
    app.post('/csv', csvUpload.single('file'), (req, res) => {
        res.json({ size: req.file?.size, hasBuffer: Buffer.isBuffer(req.file?.buffer) });
    });
    await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(coversDir, { recursive: true, force: true });
});

const upload = (path: string, field: string, bytes: Buffer, name: string, type: string, extra: Record<string, string> = {}) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(extra)) form.append(key, value);
    form.append(field, new Blob([new Uint8Array(bytes)], { type }), name);
    return fetch(`${base}${path}`, { method: 'POST', body: form });
};

describe('uploadCover', () => {
    it('stores a PNG on disk under a unique name and keeps the extension and text fields', async () => {
        const res = await upload('/cover', 'cover', Buffer.alloc(2048, 1), 'front.png', 'image/png', { title: 'Kind of Blue' });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.filename).toMatch(/^\d+-\d+\.png$/);
        expect(body.size).toBe(2048);
        expect(body.fields).toEqual({ title: 'Kind of Blue' });
        expect(fs.statSync(path.join(coversDir, body.filename)).size).toBe(2048);
    });

    it.each([['image/jpeg', 'a.jpg'], ['image/webp', 'a.webp']])('accepts %s', async (type, name) => {
        const res = await upload('/cover', 'cover', Buffer.alloc(64), name, type);
        expect(res.status).toBe(201);
    });

    it('rejects a file over 5 MB with 413 and leaves nothing on disk', async () => {
        const before = fs.readdirSync(coversDir).length;
        const res = await upload('/cover', 'cover', Buffer.alloc(5 * 1024 * 1024 + 1), 'big.png', 'image/png');

        expect(res.status).toBe(413);
        expect((await res.json()).message).toMatch(/too large/i);
        expect(fs.readdirSync(coversDir).length).toBe(before);
    });

    it('rejects a type that is not JPEG, PNG or WebP with 400', async () => {
        const res = await upload('/cover', 'cover', Buffer.alloc(64), 'a.gif', 'image/gif');

        expect(res.status).toBe(400);
        expect((await res.json()).message).toMatch(/JPEG, PNG, and WebP/);
    });

    it('rejects a file sent under the wrong field name with 400 instead of a 500', async () => {
        const res = await upload('/cover', 'photo', Buffer.alloc(64), 'a.png', 'image/png');

        expect(res.status).toBe(400);
        expect((await res.json()).message).toMatch(/Upload error/);
    });

    it('lets a request without a file through, so metadata-only edits still work', async () => {
        const form = new FormData();
        form.append('title', 'No cover');
        const res = await fetch(`${base}/cover`, { method: 'POST', body: form });

        expect(res.status).toBe(201);
        expect((await res.json()).filename).toBeUndefined();
    });
});

describe('csvUpload', () => {
    it('keeps the file in memory and does not write it to disk', async () => {
        const csv = Buffer.from('Title,Artist\nBlue,Joni Mitchell\n');
        const res = await upload('/csv', 'file', csv, 'import.csv', 'text/csv');

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ size: csv.length, hasBuffer: true });
    });

    it('accepts a file larger than the 5 MB cover limit', async () => {
        const res = await upload('/csv', 'file', Buffer.alloc(6 * 1024 * 1024, 65), 'big.csv', 'text/csv');
        expect(res.status).toBe(200);
    });
});
