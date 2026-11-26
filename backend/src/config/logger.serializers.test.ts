import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import axios from 'axios';
import http from 'http';
import type { AddressInfo } from 'net';
import { redactUrl, serializeError } from './logger.serializers';

const KEY = 'FAKEKEY123';
const SECRET = 'FAKESECRET456';

// A real axios error from a real HTTP exchange. Hand-built objects would not
// show what a given axios release attaches to the error, which is the part
// that changed between 1.10 (nothing sensitive reached the log) and 1.21 (the
// raw request, with the Discogs key and secret in its URL, did).
let server: http.Server;
let base: string;

beforeAll(async () => {
    server = http.createServer((_req, res) => {
        res.statusCode = 401;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ message: 'You must authenticate to access this resource.' }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

const failure = (request: Promise<unknown>) => request.then(() => { throw new Error('expected the request to fail'); }, (err: unknown) => err);

describe('serializeError', () => {
    it('keeps credentials sent as params out of an axios error', async () => {
        const err = await failure(axios.get(`${base}/database/search`, { params: { q: 'Miles Davis', key: KEY, secret: SECRET } }));

        const logged = JSON.stringify(serializeError(err));

        expect(logged).not.toContain(KEY);
        expect(logged).not.toContain(SECRET);
    });

    it('keeps credentials written into the URL out of an axios error', async () => {
        const err = await failure(axios.get(`${base}/database/search?q=Miles&key=${KEY}&secret=${SECRET}`));

        const logged = JSON.stringify(serializeError(err));

        expect(logged).not.toContain(KEY);
        expect(logged).not.toContain(SECRET);
    });

    it('keeps credentials in an Authorization header out of the log', async () => {
        const err = await failure(axios.get(`${base}/x`, { headers: { Authorization: 'Discogs token=FAKEPAT789' } }));

        expect(JSON.stringify(serializeError(err))).not.toContain('FAKEPAT789');
    });

    it('still says what went wrong: status, method, path, search term and response body', async () => {
        const err = await failure(axios.get(`${base}/database/search`, { params: { q: 'Miles Davis', key: KEY } }));

        expect(serializeError(err)).toMatchObject({
            type: 'AxiosError',
            message: 'Request failed with status code 401',
            status: 401,
            method: 'GET',
            params: { q: 'Miles Davis', key: '[redacted]' },
            responseBody: expect.stringContaining('You must authenticate')
        });
    });

    it('does not dump the request, response objects or sockets', async () => {
        const err = await failure(axios.get(`${base}/x`));

        const serialized = serializeError(err) as Record<string, unknown>;

        expect(serialized).not.toHaveProperty('request');
        expect(serialized).not.toHaveProperty('response');
        expect(serialized).not.toHaveProperty('config');
        expect(JSON.stringify(serialized).length).toBeLessThan(2000);
    });

    it('truncates a long response body', async () => {
        const err = { isAxiosError: true, message: 'm', response: { status: 500, data: 'x'.repeat(5000) }, config: {} };

        expect((serializeError(err) as { responseBody: string }).responseBody.length).toBeLessThan(600);
    });

    it('leaves other errors to the standard serializer', () => {
        const serialized = serializeError(new TypeError('boom')) as { type: string; message: string; stack: string };

        expect(serialized).toMatchObject({ type: 'TypeError', message: 'boom' });
        expect(serialized.stack).toContain('boom');
    });

    it('does not throw on odd input', () => {
        expect(() => serializeError(null)).not.toThrow();
        expect(() => serializeError(undefined)).not.toThrow();
        expect(() => serializeError('just a string')).not.toThrow();
        expect(() => serializeError({ isAxiosError: true })).not.toThrow();
    });
});

describe('redactUrl', () => {
    it('replaces credential parameters and keeps the others', () => {
        expect(redactUrl(`https://api.discogs.com/database/search?q=Kind+of+Blue&key=${KEY}&secret=${SECRET}&type=release`))
            .toBe('https://api.discogs.com/database/search?q=Kind+of+Blue&key=[redacted]&secret=[redacted]&type=release');
    });

    it.each(['token', 'apikey', 'api_key', 'access_token', 'KEY'])('redacts %s whatever its case', (name) => {
        expect(redactUrl(`https://x.test/a?${name}=hunter2`)).not.toContain('hunter2');
    });

    it('keeps a relative URL relative', () => {
        expect(redactUrl('/database/search?key=abc&q=x')).toBe('/database/search?key=[redacted]&q=x');
    });

    it('returns undefined for a non-string', () => {
        expect(redactUrl(undefined)).toBeUndefined();
        expect(redactUrl(42)).toBeUndefined();
    });
});
