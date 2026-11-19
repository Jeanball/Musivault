import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserFormModal from './UserFormModal';
import { createUser, updateUser } from '../../api/users';
import { ApiError } from '../../api/errors';
import { toastService } from '../../utils/toast';
import type { AdminUser } from '../../types/admin.types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../api/users', () => ({ createUser: vi.fn(), updateUser: vi.fn() }));
vi.mock('../../utils/toast', () => ({ toastService: { success: vi.fn(), error: vi.fn() } }));

const sam: AdminUser = {
    _id: 'user-1',
    username: 'sam',
    email: 'sam@example.com',
    isAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    isPublic: false,
    publicShareId: 'share-1',
};

const type = (label: RegExp | string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
// The dialog is shown by daisyUI's `modal-open` class rather than the `open` attribute, so jsdom treats it as hidden.
const button = (name: string) => screen.getByRole('button', { name, hidden: true });
const alert = () => screen.findByRole('alert', { hidden: true });
const save = () => fireEvent.click(button('common.save'));

describe('UserFormModal: add', () => {
    const onSaved = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(createUser).mockResolvedValue(undefined);
    });

    it('creates a regular user from the filled form and tells the page to reload', async () => {
        render(<UserFormModal onClose={vi.fn()} onSaved={onSaved} />);
        expect(screen.getByText('admin.addUser')).toBeInTheDocument();

        type('auth.username', ' alex ');
        type('auth.email', 'alex@example.com');
        type('auth.password', 'secret1');
        save();

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        expect(createUser).toHaveBeenCalledWith({ username: 'alex', email: 'alex@example.com', password: 'secret1', isAdmin: false });
        expect(toastService.success).toHaveBeenCalledWith('admin.userCreated');
    });

    it('creates an administrator when the box is ticked', async () => {
        render(<UserFormModal onClose={vi.fn()} onSaved={onSaved} />);

        type('auth.username', 'root');
        type('auth.email', 'root@example.com');
        type('auth.password', 'secret1');
        fireEvent.click(screen.getByLabelText('admin.administratorRole'));
        save();

        await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ isAdmin: true })));
    });

    it.each([
        ['without a username', { email: 'a@b.co', password: 'secret1' }],
        ['without an email', { username: 'alex', password: 'secret1' }],
        ['without a password', { username: 'alex', email: 'a@b.co' }],
    ])('does not send a form %s', (_label, values: Record<string, string>) => {
        render(<UserFormModal onClose={vi.fn()} onSaved={onSaved} />);
        if (values.username) type('auth.username', values.username);
        if (values.email) type('auth.email', values.email);
        if (values.password) type('auth.password', values.password);

        save();

        expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('admin.userFormRequired');
        expect(createUser).not.toHaveBeenCalled();
    });

    it('does not send a password under 6 characters', () => {
        render(<UserFormModal onClose={vi.fn()} onSaved={onSaved} />);
        type('auth.username', 'alex');
        type('auth.email', 'a@b.co');
        type('auth.password', '12345');

        save();

        expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('settings.passwordTooShort');
        expect(createUser).not.toHaveBeenCalled();
    });

    it('shows what the server says, and stays open, when the username is taken', async () => {
        vi.mocked(createUser).mockRejectedValue(new ApiError({ status: 400, message: 'Bad Request', serverMessage: 'Username is already taken' }));
        render(<UserFormModal onClose={vi.fn()} onSaved={onSaved} />);
        type('auth.username', 'sam');
        type('auth.email', 'new@example.com');
        type('auth.password', 'secret1');

        save();

        expect(await alert()).toHaveTextContent('Username is already taken');
        expect(onSaved).not.toHaveBeenCalled();
    });

    it('falls back to a general message when the server gives none', async () => {
        vi.mocked(createUser).mockRejectedValue(new Error('network'));
        render(<UserFormModal onClose={vi.fn()} onSaved={onSaved} />);
        type('auth.username', 'alex');
        type('auth.email', 'a@b.co');
        type('auth.password', 'secret1');

        save();

        expect(await alert()).toHaveTextContent('admin.errorCreating');
    });
});

describe('UserFormModal: edit', () => {
    const onSaved = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(updateUser).mockResolvedValue(undefined);
    });

    it('starts from the user and says a blank password keeps the current one', () => {
        render(<UserFormModal user={sam} onClose={vi.fn()} onSaved={onSaved} />);

        expect(screen.getByText('admin.editUser')).toBeInTheDocument();
        expect(screen.getByLabelText('auth.username')).toHaveValue('sam');
        expect(screen.getByLabelText('auth.email')).toHaveValue('sam@example.com');
        expect(screen.getByLabelText('auth.password')).toHaveValue('');
        expect(screen.getByText('admin.keepPasswordHint')).toBeInTheDocument();
    });

    it('sends only what changed', async () => {
        render(<UserFormModal user={sam} onClose={vi.fn()} onSaved={onSaved} />);

        type('auth.username', 'samuel');
        save();

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        expect(updateUser).toHaveBeenCalledWith('user-1', { username: 'samuel' });
    });

    it('sends nothing but a new password when only that was typed, and the role when it was toggled', async () => {
        render(<UserFormModal user={sam} onClose={vi.fn()} onSaved={onSaved} />);

        type('auth.password', 'brand-new');
        fireEvent.click(screen.getByLabelText('admin.administratorRole'));
        save();

        await waitFor(() => expect(updateUser).toHaveBeenCalledWith('user-1', { password: 'brand-new', isAdmin: true }));
    });

    it('keeps the role fixed when an administrator edits their own account', async () => {
        render(<UserFormModal user={{ ...sam, isAdmin: true }} isSelf onClose={vi.fn()} onSaved={onSaved} />);

        expect(screen.getByLabelText('admin.administratorRole')).toBeDisabled();
        type('auth.email', 'me@example.com');
        save();

        await waitFor(() => expect(updateUser).toHaveBeenCalledWith('user-1', { email: 'me@example.com' }));
    });

    it('shows the server message when the change is refused', async () => {
        vi.mocked(updateUser).mockRejectedValue(new ApiError({ status: 400, message: 'Bad Request', serverMessage: 'Email is already in use' }));
        render(<UserFormModal user={sam} onClose={vi.fn()} onSaved={onSaved} />);

        type('auth.email', 'taken@example.com');
        save();

        expect(await alert()).toHaveTextContent('Email is already in use');
        expect(onSaved).not.toHaveBeenCalled();
    });

    it('closes without saving on cancel', () => {
        const onClose = vi.fn();
        render(<UserFormModal user={sam} onClose={onClose} onSaved={onSaved} />);

        fireEvent.click(button('common.cancel'));

        expect(onClose).toHaveBeenCalled();
        expect(updateUser).not.toHaveBeenCalled();
    });
});
