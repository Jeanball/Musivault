import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createUser, updateUser } from '../../api/users';
import { isApiError } from '../../api/errors';
import { toastService } from '../../utils/toast';
import type { AdminUser } from '../../types/admin.types';

const MIN_PASSWORD_LENGTH = 6;

interface UserFormModalProps {
    /** The user to edit; without it the form creates a new one. */
    user?: AdminUser | null;
    /** The signed-in administrator editing their own account cannot change their role. */
    isSelf?: boolean;
    onClose: () => void;
    /** Called after the server accepted the change, so the list can be reloaded. */
    onSaved: () => void;
}

/**
 * Add a user, or edit a user's username, email, role and password, from the
 * Administration page. When editing, only the fields that changed are sent and
 * a blank password keeps the current one.
 */
const UserFormModal: React.FC<UserFormModalProps> = ({ user, isSelf = false, onClose, onSaved }) => {
    const { t } = useTranslation();
    const isEditing = Boolean(user);
    const [username, setUsername] = useState(user?.username ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [password, setPassword] = useState('');
    const [isAdmin, setIsAdmin] = useState(user?.isAdmin ?? false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const name = username.trim();
        const mail = email.trim();

        if (!name || !mail || (!isEditing && !password)) {
            setError(t('admin.userFormRequired'));
            return;
        }
        if (password && password.length < MIN_PASSWORD_LENGTH) {
            setError(t('settings.passwordTooShort'));
            return;
        }

        setError(null);
        setIsSubmitting(true);
        try {
            if (user) {
                await updateUser(user._id, {
                    ...(name !== user.username && { username: name }),
                    ...(mail !== user.email && { email: mail }),
                    ...(password && { password }),
                    ...(!isSelf && isAdmin !== user.isAdmin && { isAdmin }),
                });
                toastService.success(t('admin.userUpdated', { username: name }));
            } else {
                await createUser({ username: name, email: mail, password, isAdmin });
                toastService.success(t('admin.userCreated', { username: name }));
            }
            onSaved();
        } catch (err) {
            console.error('Error saving user:', err);
            // The server says what is wrong: a taken username or email, the last administrator, ...
            setError(isApiError(err) && err.serverMessage
                ? err.serverMessage
                : t(isEditing ? 'admin.errorUpdating' : 'admin.errorCreating'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <dialog className="modal modal-open modal-middle px-2 sm:px-4">
            <div className="modal-box max-w-md w-full max-h-[90vh] overflow-y-auto">
                <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
                    aria-label={t('common.close')}
                >
                    <X className="w-4 h-4" />
                </button>
                <h3 className="font-bold text-lg mb-4">{isEditing ? t('admin.editUser') : t('admin.addUser')}</h3>

                <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                    <div className="flex flex-col">
                        <label className="label" htmlFor="admin-user-username">
                            <span className="text-sm">{t('auth.username')}</span>
                        </label>
                        <input
                            id="admin-user-username"
                            type="text"
                            className="input w-full"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="off"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="label" htmlFor="admin-user-email">
                            <span className="text-sm">{t('auth.email')}</span>
                        </label>
                        <input
                            id="admin-user-email"
                            type="email"
                            className="input w-full"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="off"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="label" htmlFor="admin-user-password">
                            <span className="text-sm">{t('auth.password')}</span>
                        </label>
                        <input
                            id="admin-user-password"
                            type="password"
                            className="input w-full"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                        />
                        {isEditing && (
                            <span className="text-xs text-base-content/50 mt-1">{t('admin.keepPasswordHint')}</span>
                        )}
                    </div>

                    <label className="label cursor-pointer justify-start gap-3" htmlFor="admin-user-role">
                        <input
                            id="admin-user-role"
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={isAdmin}
                            disabled={isSelf}
                            onChange={(e) => setIsAdmin(e.target.checked)}
                        />
                        <span className="text-sm">{t('admin.administratorRole')}</span>
                    </label>

                    {error && (
                        <div role="alert" className="alert alert-error alert-soft text-sm py-2">
                            {error}
                        </div>
                    )}

                    <div className="modal-action">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>{t('common.close')}</button>
            </form>
        </dialog>
    );
};

export default UserFormModal;
