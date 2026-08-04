import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import { updateProfile, updatePassword } from '../../api/users';
import { isApiError } from '../../api/errors';
import { toastService } from '../../utils/toast';
import type { PrivateOutletContext } from '../../types/auth.types';
import { User, Mail, AtSign, Lock } from 'lucide-react';

const ProfileSettings: React.FC = () => {
    const { t } = useTranslation();
    const { username, email, displayName, refreshUser } = useOutletContext<PrivateOutletContext>();

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        displayName: displayName || '',
        username: username || '',
        email: email || ''
    });
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);

    // Update form when context changes
    React.useEffect(() => {
        setProfileForm({
            displayName: displayName || '',
            username: username || '',
            email: email || ''
        });
    }, [displayName, username, email]);

    const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsProfileLoading(true);

        try {
            await updateProfile(profileForm);
            toastService.success(t('settings.profileUpdated'));
            // Refresh user data in context
            await refreshUser();
        } catch (error) {
            const message = isApiError(error) ? error.serverMessage : undefined;
            toastService.error(message || t('settings.profileUpdateFailed'));
        } finally {
            setIsProfileLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const currentPassword = (form.elements.namedItem('currentPassword') as HTMLInputElement).value;
        const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
        const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

        if (newPassword !== confirmPassword) {
            toastService.error(t('settings.passwordsDoNotMatch'));
            return;
        }

        if (newPassword.length < 6) {
            toastService.error(t('settings.passwordTooShort'));
            return;
        }

        try {
            await updatePassword({ currentPassword, newPassword });
            toastService.success(t('settings.passwordUpdated'));
            form.reset();
            setIsPasswordOpen(false);
        } catch (error) {
            const message = isApiError(error) ? error.serverMessage : undefined;
            toastService.error(message || 'Failed to update password');
        }
    };

    return (
        <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {t('settings.profile')}
                </h2>
                <p className="text-sm text-base-content/50 mb-4">
                    {t('settings.profileDescription')}
                </p>

                {/* Profile Information Form */}
                <form onSubmit={handleProfileSubmit} className="mb-8">
                    <div className="space-y-4">
                        {/* Display Name */}
                        <div className="flex flex-col w-full">
                            <label className="label">
                                <span className="text-sm flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {t('settings.displayName')}
                                </span>
                            </label>
                            <input
                                type="text"
                                value={profileForm.displayName}
                                onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                                placeholder={t('settings.displayNamePlaceholder')}
                                className="input w-full"
                            />
                            <label className="label">
                                <span className="text-xs text-base-content/50">{t('settings.displayNameHint')}</span>
                            </label>
                        </div>

                        {/* Username */}
                        <div className="flex flex-col w-full">
                            <label className="label">
                                <span className="text-sm flex items-center gap-2">
                                    <AtSign className="h-4 w-4" />
                                    {t('settings.username')}
                                </span>
                            </label>
                            <input
                                type="text"
                                value={profileForm.username}
                                onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                                placeholder={t('settings.usernamePlaceholder')}
                                className="input w-full"
                                required
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col w-full">
                            <label className="label">
                                <span className="text-sm flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    {t('settings.email')}
                                </span>
                            </label>
                            <input
                                type="email"
                                value={profileForm.email}
                                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                placeholder={t('settings.emailPlaceholder')}
                                className="input w-full"
                                required
                            />
                        </div>
                    </div>

                    <div className="card-actions justify-end mt-6">
                        <button type="submit" className="btn btn-primary" disabled={isProfileLoading}>
                            {isProfileLoading ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                t('settings.saveProfile')
                            )}
                        </button>
                    </div>
                </form>

                {/* Password Change Form (collapsed by default) */}
                <div className="collapse collapse-arrow border border-base-300 bg-base-100">
                    <input
                        type="checkbox"
                        checked={isPasswordOpen}
                        onChange={(e) => setIsPasswordOpen(e.target.checked)}
                    />
                    <div className="collapse-title flex items-center gap-2 font-medium">
                        <Lock className="h-4 w-4" />
                        {t('settings.changePassword')}
                    </div>
                    <div className="collapse-content">
                        <form onSubmit={handlePasswordSubmit}>
                            <div className="space-y-4">
                                <div className="flex flex-col w-full">
                                    <label className="label">
                                        <span className="text-sm">{t('settings.currentPassword')}</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="currentPassword"
                                        placeholder={t('settings.enterCurrentPassword')}
                                        className="input w-full"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col w-full">
                                        <label className="label">
                                            <span className="text-sm">{t('settings.newPassword')}</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="newPassword"
                                            placeholder={t('settings.enterNewPassword')}
                                            className="input w-full"
                                            required
                                        />
                                    </div>

                                    <div className="flex flex-col w-full">
                                        <label className="label">
                                            <span className="text-sm">{t('settings.confirmNewPassword')}</span>
                                        </label>
                                        <input
                                            type="password"
                                            name="confirmPassword"
                                            placeholder={t('settings.confirmPassword')}
                                            className="input w-full"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="card-actions justify-end mt-6">
                                <button type="submit" className="btn btn-primary">
                                    {t('settings.updatePassword')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileSettings;
