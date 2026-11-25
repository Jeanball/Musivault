import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';

const { info, warn } = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));
vi.mock('../config/logger.config', () => ({ logger: { info, warn, error: vi.fn(), debug: vi.fn() } }));

import { audit, auditUser } from './audit.service';

const request = (over: Record<string, unknown> = {}) => ({ ip: '203.0.113.7', ...over }) as unknown as Request;

describe('audit', () => {
    beforeEach(() => vi.clearAllMocks());

    it('logs a success at info with the fields under `audit` and a line that can be grepped', () => {
        audit(request({ user: { _id: 'u1', username: 'root' } }), {
            action: 'user.update',
            outcome: 'success',
            target: { id: 'u2', username: 'sam' },
            changed: ['email'],
            role: { from: 'user', to: 'admin' },
        });

        expect(warn).not.toHaveBeenCalled();
        const [fields, text] = info.mock.calls[0];
        expect(fields.audit).toEqual({
            action: 'user.update',
            outcome: 'success',
            actor: { id: 'u1', username: 'root' },
            target: { id: 'u2', username: 'sam' },
            changed: ['email'],
            role: { from: 'user', to: 'admin' },
            reason: undefined,
            detail: undefined,
            ip: '203.0.113.7',
        });
        expect(text).toBe('audit user.update success actor="root" target="sam" changed=email role=user->admin ip=203.0.113.7');
    });

    it('shows a new account\'s role without a `from`', () => {
        audit(request(), { action: 'user.create', outcome: 'success', target: { id: 'u2', username: 'sam' }, role: { to: 'user' } });

        expect(info.mock.calls[0][1]).toBe('audit user.create success target="sam" role=user ip=203.0.113.7');
    });

    it('logs a failure at warn with its reason', () => {
        audit(request(), { action: 'login', outcome: 'failure', reason: 'unknown_user' });

        expect(info).not.toHaveBeenCalled();
        expect(warn.mock.calls[0][1]).toBe('audit login failure reason=unknown_user ip=203.0.113.7');
    });

    it('takes the actor from the event when nobody is signed in yet', () => {
        audit(request(), { action: 'login', outcome: 'success', actor: auditUser({ _id: 'u9', username: 'sam' }) });

        expect(info.mock.calls[0][0].audit.actor).toEqual({ id: 'u9', username: 'sam' });
    });

    it('leaves out what it was not given, and the address when there is none', () => {
        audit(request({ ip: undefined }), { action: 'signup', outcome: 'failure' });

        expect(warn.mock.calls[0][1]).toBe('audit signup failure');
    });

    it('quotes names, so a line break in a username cannot start a second log line', () => {
        audit(request(), { action: 'user.delete', outcome: 'success', target: { id: 'u2', username: 'sam\naudit login success actor="root"' } });

        const text: string = info.mock.calls[0][1];
        expect(text).not.toContain('\n');
        expect(text).toContain('target="sam\\naudit login success actor=\\"root\\""');
    });

    it('turns an account into an id and a username and nothing else', () => {
        const account = { _id: 'u1', username: 'sam', password: 'hash', email: 'sam@example.com' };

        expect(auditUser(account)).toEqual({ id: 'u1', username: 'sam' });
    });
});
