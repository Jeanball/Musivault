import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { createAdminUser, deleteUser, getUserById, updateUser } from './users.controller';
import User from '../models/User';

vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../models/CollectionItem', () => ({ default: { countDocuments: vi.fn(), findOne: vi.fn() } }));
vi.mock('../models/User', () => {
    const model = vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
        Object.assign(this, data, { _id: 'new-id', createdAt: new Date('2026-11-19T00:00:00Z'), save: vi.fn().mockResolvedValue(undefined) });
    });
    Object.assign(model, { findOne: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), findByIdAndDelete: vi.fn() });
    return { default: model };
});

const id = () => new mongoose.Types.ObjectId();
const response = () => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
};
const call = (handler: (req: never, res: never) => Promise<void>, body: Record<string, unknown>, params: Record<string, string> = {}, user?: { _id: unknown }) => {
    const res = response();
    return handler({ body, params, user } as never, res as never).then(() => res);
};
const stored = (over: Record<string, unknown> = {}) => ({
    _id: id(),
    username: 'sam',
    email: 'sam@example.com',
    isAdmin: false,
    save: vi.fn().mockResolvedValue(undefined),
    ...over,
});
const message = (res: ReturnType<typeof response>) => res.json.mock.calls[0][0].message;

describe('createAdminUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(User.findOne).mockResolvedValue(null as never);
    });

    it('creates a regular user unless an administrator is asked for', async () => {
        const res = await call(createAdminUser, { username: ' sam ', email: 'Sam@Example.com', password: 'secret1' });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(User).toHaveBeenCalledWith({ username: 'sam', email: 'Sam@Example.com', password: 'secret1', isAdmin: false });
        const { user } = res.json.mock.calls[0][0];
        expect(user).toMatchObject({ username: 'sam', isAdmin: false });
        expect(user).not.toHaveProperty('password');
    });

    it('creates an administrator when isAdmin is true', async () => {
        const res = await call(createAdminUser, { username: 'root', email: 'root@example.com', password: 'secret1', isAdmin: true });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json.mock.calls[0][0].user.isAdmin).toBe(true);
    });

    it('does not take "true" sent as text for a yes', async () => {
        await call(createAdminUser, { username: 'sam', email: 'sam@example.com', password: 'secret1', isAdmin: 'true' });

        expect(User).toHaveBeenCalledWith(expect.objectContaining({ isAdmin: false }));
    });

    it.each([
        ['no username', { email: 'a@b.co', password: 'secret1' }],
        ['a blank username', { username: '   ', email: 'a@b.co', password: 'secret1' }],
        ['no email', { username: 'sam', password: 'secret1' }],
        ['no password', { username: 'sam', email: 'a@b.co' }],
        ['a password that is not text', { username: 'sam', email: 'a@b.co', password: 123456 }],
    ])('rejects %s', async (_label, body) => {
        const res = await call(createAdminUser, body);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(User).not.toHaveBeenCalled();
    });

    it('rejects a malformed email', async () => {
        const res = await call(createAdminUser, { username: 'sam', email: 'not-an-email', password: 'secret1' });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe('Email is not valid');
    });

    it('rejects a password under 6 characters', async () => {
        const res = await call(createAdminUser, { username: 'sam', email: 'a@b.co', password: '12345' });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toMatch(/at least 6/);
    });

    it('rejects a username another user has, since login accepts it as the identifier', async () => {
        vi.mocked(User.findOne).mockImplementation((async (query: { username?: string }) => (query.username ? stored() : null)) as never);

        const res = await call(createAdminUser, { username: 'sam', email: 'new@example.com', password: 'secret1' });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe('Username is already taken');
        expect(User).not.toHaveBeenCalled();
    });

    it('rejects an email another user has, whatever its case', async () => {
        vi.mocked(User.findOne).mockImplementation((async (query: { email?: string }) => (query.email === 'sam@example.com' ? stored() : null)) as never);

        const res = await call(createAdminUser, { username: 'other', email: 'SAM@Example.com', password: 'secret1' });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe('Email is already in use');
    });

    it('answers 500 instead of leaving the request hanging when saving fails', async () => {
        vi.mocked(User.findOne).mockRejectedValue(new Error('db down'));

        const res = await call(createAdminUser, { username: 'sam', email: 'a@b.co', password: 'secret1' });

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe('updateUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(User.findOne).mockResolvedValue(null as never);
        vi.mocked(User.countDocuments).mockResolvedValue(1 as never);
    });

    const update = (user: ReturnType<typeof stored> | null, body: Record<string, unknown>) => {
        vi.mocked(User.findById).mockResolvedValue(user as never);
        return call(updateUser, body, { id: String(user?._id ?? id()) });
    };

    it('changes only the fields that were sent', async () => {
        const user = stored();

        const res = await update(user, { username: ' samuel ', email: 'Samuel@Example.com' });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(user).toMatchObject({ username: 'samuel', email: 'Samuel@Example.com', isAdmin: false });
        expect(user).not.toHaveProperty('password');
        expect(user.save).toHaveBeenCalled();
    });

    it('sets a new password and the role', async () => {
        const user = stored();

        await update(user, { password: 'brand-new', isAdmin: true });

        expect(user).toMatchObject({ password: 'brand-new', isAdmin: true });
    });

    it('answers 404 for an unknown user and for an id that is not an id', async () => {
        expect((await update(null, { username: 'x' })).status).toHaveBeenCalledWith(404);

        const res = await call(updateUser, { username: 'x' }, { id: 'nope' });
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it.each([
        ['a blank username', { username: '  ' }, /cannot be empty/],
        ['a blank email', { email: '' }, /cannot be empty/],
        ['a malformed email', { email: 'nope' }, /not valid/],
        ['a password under 6 characters', { password: '12345' }, /at least 6/],
        ['an empty password', { password: '' }, /at least 6/],
    ])('rejects %s without saving', async (_label, body, pattern) => {
        const user = stored();

        const res = await update(user, body);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toMatch(pattern);
        expect(user.save).not.toHaveBeenCalled();
    });

    it('rejects a username another user has, looking only at the other users', async () => {
        const user = stored();
        vi.mocked(User.findOne).mockResolvedValue(stored({ username: 'taken' }) as never);

        const res = await update(user, { username: 'taken' });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toBe('Username is already taken');
        expect(User.findOne).toHaveBeenCalledWith({ username: 'taken', _id: { $ne: user._id } });
        expect(user.save).not.toHaveBeenCalled();
    });

    it('rejects an email another user has', async () => {
        const user = stored();
        vi.mocked(User.findOne).mockResolvedValue(stored({ email: 'taken@example.com' }) as never);

        const res = await update(user, { email: 'Taken@Example.com' });

        expect(message(res)).toBe('Email is already in use');
        expect(User.findOne).toHaveBeenCalledWith({ email: 'taken@example.com', _id: { $ne: user._id } });
    });

    it('does not check for a conflict when the username and email are unchanged', async () => {
        const user = stored();

        const res = await update(user, { username: 'sam', email: 'SAM@example.com' });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(User.findOne).not.toHaveBeenCalled();
    });

    it('refuses to demote the last administrator', async () => {
        const user = stored({ isAdmin: true });
        vi.mocked(User.countDocuments).mockResolvedValue(0 as never);

        const res = await update(user, { isAdmin: false });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toMatch(/last administrator/);
        expect(user.isAdmin).toBe(true);
        expect(user.save).not.toHaveBeenCalled();
        expect(User.countDocuments).toHaveBeenCalledWith({ isAdmin: true, _id: { $ne: user._id } });
    });

    it('demotes an administrator when another one is left', async () => {
        const user = stored({ isAdmin: true });

        const res = await update(user, { isAdmin: false });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(user.isAdmin).toBe(false);
    });
});

describe('deleteUser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(User.countDocuments).mockResolvedValue(1 as never);
    });

    const remove = (user: ReturnType<typeof stored> | null, caller: { _id: unknown } = { _id: id() }) => {
        vi.mocked(User.findById).mockResolvedValue(user as never);
        return call(deleteUser, {}, { id: String(user?._id ?? id()) }, caller);
    };

    it('deletes another user', async () => {
        const user = stored();

        const res = await remove(user);

        expect(res.status).not.toHaveBeenCalled();
        expect(User.findByIdAndDelete).toHaveBeenCalledWith(user._id);
    });

    it('refuses to delete the account that is signed in', async () => {
        const user = stored({ isAdmin: true });

        const res = await remove(user, { _id: user._id });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(message(res)).toMatch(/your own account/);
        expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('deletes another administrator', async () => {
        const user = stored({ isAdmin: true });

        await remove(user);

        expect(User.findByIdAndDelete).toHaveBeenCalledWith(user._id);
    });

    it('answers 404 for an unknown user', async () => {
        const res = await remove(null);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    });
});

describe('getUserById', () => {
    beforeEach(() => vi.clearAllMocks());

    it('leaves the password hash and the encrypted Discogs token out', async () => {
        const user = stored();
        const select = vi.fn().mockResolvedValue(user);
        vi.mocked(User.findById).mockReturnValue({ select } as never);

        const res = await call(getUserById, {}, { id: String(user._id) });

        expect(select).toHaveBeenCalledWith('-password -discogs.tokenEncrypted');
        expect(res.json).toHaveBeenCalledWith(user);
    });

    it('answers 404 for an unknown user', async () => {
        vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue(null) } as never);

        const res = await call(getUserById, {}, { id: String(id()) });

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
