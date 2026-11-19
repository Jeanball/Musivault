import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminPage from './AdminPage';
import { createUser, getUsers, updateUser } from '../api/users';
import { verify } from '../api/auth';
import type { AdminUser } from '../types/admin.types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
const navigate = vi.fn();
vi.mock('react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../api/users', () => ({ getUsers: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn() }));
vi.mock('../api/auth', () => ({ verify: vi.fn() }));
vi.mock('../utils/toast', () => ({ toastService: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/Admin/AdminTabs', () => ({ default: () => null }));

const user = (over: Partial<AdminUser>): AdminUser => ({
    _id: 'id',
    username: 'name',
    email: 'name@example.com',
    isAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    isPublic: false,
    publicShareId: 'share',
    albumCount: 0,
    ...over,
});
const root = user({ _id: 'root-id', username: 'root', email: 'root@example.com', isAdmin: true });
const sam = user({ _id: 'sam-id', username: 'sam', email: 'sam@example.com' });

const dialog = () => document.querySelector('dialog') as HTMLElement;
const inDialog = () => within(dialog());

describe('AdminPage add and edit users', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(verify).mockResolvedValue({ status: true, isAdmin: true, user: 'root' } as never);
        vi.mocked(getUsers).mockResolvedValue([root, sam]);
        vi.mocked(createUser).mockResolvedValue(undefined);
        vi.mocked(updateUser).mockResolvedValue(undefined);
    });

    it('opens an empty form from "Add user", creates the user and reloads the list', async () => {
        render(<AdminPage />);
        fireEvent.click(await screen.findByRole('button', { name: /admin\.addUser/ }));

        expect(inDialog().getByLabelText('auth.username')).toHaveValue('');
        fireEvent.change(inDialog().getByLabelText('auth.username'), { target: { value: 'alex' } });
        fireEvent.change(inDialog().getByLabelText('auth.email'), { target: { value: 'alex@example.com' } });
        fireEvent.change(inDialog().getByLabelText('auth.password'), { target: { value: 'secret1' } });
        fireEvent.click(inDialog().getByRole('button', { name: 'common.save', hidden: true }));

        await waitFor(() => expect(createUser).toHaveBeenCalledWith({ username: 'alex', email: 'alex@example.com', password: 'secret1', isAdmin: false }));
        await waitFor(() => expect(getUsers).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(dialog()).toBeNull());
    });

    it('opens the form with the user from the edit button, and saves only the change', async () => {
        render(<AdminPage />);
        await screen.findAllByText('sam');

        // The table and the mobile cards both list the user; the first edit button of sam is in the table.
        const edit = screen.getAllByTitle('admin.editUser');
        fireEvent.click(edit[1]);

        expect(inDialog().getByLabelText('auth.username')).toHaveValue('sam');
        expect(inDialog().getByLabelText('admin.administratorRole')).not.toBeDisabled();
        fireEvent.change(inDialog().getByLabelText('auth.email'), { target: { value: 'samuel@example.com' } });
        fireEvent.click(inDialog().getByRole('button', { name: 'common.save', hidden: true }));

        await waitFor(() => expect(updateUser).toHaveBeenCalledWith('sam-id', { email: 'samuel@example.com' }));
    });

    it('does not let an administrator change their own role in the form', async () => {
        render(<AdminPage />);
        await screen.findAllByText('root');

        fireEvent.click(screen.getAllByTitle('admin.editUser')[0]);

        expect(inDialog().getByLabelText('auth.username')).toHaveValue('root');
        expect(inDialog().getByLabelText('admin.administratorRole')).toBeDisabled();
    });
});
