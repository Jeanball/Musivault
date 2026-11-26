import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

const { loginUser, signupUser, userVerification, getAuthConfig, audit } = vi.hoisted(() => ({
    loginUser: vi.fn((_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => res.status(401).json({ message: 'Invalid credentials' })),
    signupUser: vi.fn((_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => res.status(201).json({ success: true })),
    userVerification: vi.fn((_req: unknown, res: { json: (b: unknown) => void }) => res.json({ status: false })),
    getAuthConfig: vi.fn((_req: unknown, res: { json: (b: unknown) => void }) => res.json({ signupEnabled: true })),
    audit: vi.fn(),
}));

vi.mock('../controllers/auth.controller', () => ({
    loginUser, signupUser, userVerification, getAuthConfig,
    logoutUser: (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true }),
}));
vi.mock('./oidc.route', async () => ({ default: (await import('express')).Router() }));
vi.mock('../services/audit.service', () => ({ audit }));

// The limiter is created when the route module loads, so each test re-imports
// the module to start with an empty rate-limit window.
let server: Server;
let base: string;

const start = async () => {
    vi.resetModules();
    const { default: authRoute } = await import('./auth.route');
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoute);
    await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`;
};

const post = (route: string) => fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'sam', password: 'secret1' }),
});

describe('credential rate limiting', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await start();
    });
    afterEach(() => new Promise(resolve => server.close(resolve)));

    it('serves 100 login attempts, then answers 429 with a JSON message and rate-limit headers', async () => {
        for (let i = 0; i < 100; i++) expect((await post('/login')).status).toBe(401);

        const blocked = await post('/login');
        expect(blocked.status).toBe(429);
        expect(await blocked.json()).toEqual({ message: 'Too many attempts. Try again in a few minutes.' });
        expect(blocked.headers.get('ratelimit-policy') ?? blocked.headers.get('ratelimit')).toBeTruthy();
        expect(blocked.headers.get('x-ratelimit-limit')).toBeNull();
        expect(loginUser).toHaveBeenCalledTimes(100);
    });

    it('records the throttled request in the audit log without running the controller', async () => {
        for (let i = 0; i < 101; i++) await post('/login');

        expect(audit).toHaveBeenCalledTimes(1);
        expect(audit).toHaveBeenCalledWith(expect.anything(), { action: 'rate_limited', outcome: 'failure', detail: 'POST /api/auth/login' });
    });

    it('counts login and signup against the same window', async () => {
        for (let i = 0; i < 100; i++) await post('/login');

        expect((await post('/signup')).status).toBe(429);
        expect(signupUser).not.toHaveBeenCalled();
    });

    it('never throttles /verify or /config, which run on every page load', async () => {
        for (let i = 0; i < 100; i++) await post('/login');

        expect((await post('/verify')).status).toBe(200);
        expect((await fetch(`${base}/config`)).status).toBe(200);
        expect((await post('/logout')).status).toBe(200);
    });
});
