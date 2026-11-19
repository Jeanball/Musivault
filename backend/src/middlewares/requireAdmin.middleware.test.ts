import { beforeEach, describe, expect, it, vi } from 'vitest';
import requireAdmin from './requireAdmin.middleware';
import { audit } from '../services/audit.service';

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../services/audit.service', () => ({ audit: vi.fn() }));

const response = () => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
};

describe('requireAdmin', () => {
    beforeEach(() => vi.clearAllMocks());

    it('lets an administrator through without recording anything', async () => {
        const next = vi.fn();

        await requireAdmin({ user: { isAdmin: true } } as never, response() as never, next);

        expect(next).toHaveBeenCalled();
        expect(audit).not.toHaveBeenCalled();
    });

    it('answers 403 to a signed-in user who is not an administrator, and records the attempt', async () => {
        const res = response();
        const next = vi.fn();
        const req = { user: { isAdmin: false }, method: 'DELETE', originalUrl: '/api/users/abc' };

        await requireAdmin(req as never, res as never, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
        expect(audit).toHaveBeenCalledWith(req, { action: 'admin.forbidden', outcome: 'failure', detail: 'DELETE /api/users/abc' });
    });

    it('answers 401 when nobody is signed in', async () => {
        const res = response();

        await requireAdmin({} as never, res as never, vi.fn());

        expect(res.status).toHaveBeenCalledWith(401);
    });
});
