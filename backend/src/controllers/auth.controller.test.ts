import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginUser, signupUser } from './auth.controller';
import User from '../models/User';
import { audit } from '../services/audit.service';
import { isSignupEnabled } from '../config/auth.config';

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../config/auth.config', () => ({ isSignupEnabled: vi.fn(() => true) }));
vi.mock('../config/oidc.config', () => ({ isOIDCEnabled: vi.fn(() => false) }));
vi.mock('../utils/token.utils', () => ({ generateToken: vi.fn(() => 'token') }));
vi.mock('../services/audit.service', async importOriginal => ({ ...(await importOriginal<typeof import('../services/audit.service')>()), audit: vi.fn() }));
vi.mock('../models/User', () => {
    const model = vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
        Object.assign(this, data, { _id: 'new-id', id: 'new-id', save: vi.fn().mockResolvedValue(undefined) });
    });
    Object.assign(model, { findOne: vi.fn() });
    return { default: model };
});

const response = () => {
    const res = { status: vi.fn(), json: vi.fn(), cookie: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
};
const sam = (comparePassword: boolean) => ({
    _id: 'u1', id: 'u1', username: 'sam', email: 'sam@example.com', isAdmin: false,
    comparePassword: vi.fn().mockResolvedValue(comparePassword), save: vi.fn().mockResolvedValue(undefined),
});
const login = (body: Record<string, unknown>) => {
    const res = response();
    return loginUser({ body, ip: '203.0.113.7' } as never, res as never).then(() => res);
};

describe('login auditing', () => {
    beforeEach(() => vi.clearAllMocks());

    it('records a successful login with the account that signed in', async () => {
        vi.mocked(User.findOne).mockResolvedValue(sam(true) as never);

        const res = await login({ identifier: 'sam', password: 'secret1' });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(audit).toHaveBeenCalledWith(expect.anything(), { action: 'login', outcome: 'success', actor: { id: 'u1', username: 'sam' } });
    });

    it('records a wrong password against the account it was tried on', async () => {
        vi.mocked(User.findOne).mockResolvedValue(sam(false) as never);

        const res = await login({ identifier: 'sam', password: 'nope' });

        expect(res.status).toHaveBeenCalledWith(401);
        expect(audit).toHaveBeenCalledWith(expect.anything(), {
            action: 'login', outcome: 'failure', reason: 'wrong_password', target: { id: 'u1', username: 'sam' },
        });
    });

    it('records an unknown user without what was typed, which may be a password', async () => {
        vi.mocked(User.findOne).mockResolvedValue(null as never);

        const res = await login({ identifier: 'hunter2-typed-in-the-wrong-box', password: 'x' });

        expect(res.status).toHaveBeenCalledWith(401);
        expect(audit).toHaveBeenCalledTimes(1);
        const event = vi.mocked(audit).mock.calls[0][1];
        expect(event).toMatchObject({ action: 'login', outcome: 'failure', reason: 'unknown_user' });
        expect(JSON.stringify(event)).not.toContain('hunter2');
    });

    it('does not record a request that is missing a field: that is not an attempt', async () => {
        const res = await login({ identifier: 'sam' });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(audit).not.toHaveBeenCalled();
    });
});

describe('signup auditing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isSignupEnabled).mockReturnValue(true);
        vi.mocked(User.findOne).mockResolvedValue(null as never);
    });
    const signup = (body: Record<string, unknown>) => {
        const res = response();
        return signupUser({ body, ip: '203.0.113.7' } as never, res as never).then(() => res);
    };

    it('records a new account', async () => {
        await signup({ username: 'alex', email: 'alex@example.com', password: 'secret1' });

        expect(audit).toHaveBeenCalledWith(expect.anything(), { action: 'signup', outcome: 'success', actor: { id: 'new-id', username: 'alex' } });
    });

    it('records a signup refused because registration is closed', async () => {
        vi.mocked(isSignupEnabled).mockReturnValue(false);

        const res = await signup({ username: 'alex', email: 'alex@example.com', password: 'secret1' });

        expect(res.status).toHaveBeenCalledWith(403);
        expect(audit).toHaveBeenCalledWith(expect.anything(), { action: 'signup', outcome: 'failure', reason: 'signup_disabled' });
    });

    it('records a signup with an email that is taken', async () => {
        vi.mocked(User.findOne).mockResolvedValue({ _id: 'u1' } as never);

        await signup({ username: 'alex', email: 'sam@example.com', password: 'secret1' });

        expect(audit).toHaveBeenCalledWith(expect.anything(), { action: 'signup', outcome: 'failure', reason: 'user_exists' });
    });
});
