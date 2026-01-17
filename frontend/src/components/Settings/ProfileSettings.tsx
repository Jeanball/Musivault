import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import axios from 'axios';
import { toastService } from '../../utils/toast';
import type { PrivateOutletContext } from '../Layout/PrivateLayout';
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
            await axios.put('/api/users/profile', profileForm, { withCredentials: true });
            toastService.success(t('settings.profileUpdated'));
            // Refresh user data in context
            await refreshUser();
        } catch (error: any) {
            toastService.error(error.response?.data?.message || t('settings.profileUpdateFailed'));
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
            await axios.put('/api/users/password', { currentPassword, newPassword }, { withCredentials: true });
            toastService.success(t('settings.passwordUpdated'));
            form.reset();
        } catch (error: any) {
            toastService.error(error.response?.data?.message || 'Failed to update password');
        }
    };

    return (
        <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {t('settings.profile')}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    {t('settings.profileDescription')}
                </p>

                {/* Profile Information Form */}
                <form onSubmit={handleProfileSubmit} className="mb-8">
                    <div className="space-y-4">
                        {/* Display Name */}
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    {t('settings.displayName')}
                                </span>
                            </label>
                            <input
                                type="text"
                                value={profileForm.displayName}
                                onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                                placeholder={t('settings.displayNamePlaceholder')}
                                className="input input-bordered w-full"
                            />
                            <label className="label">
                                <span className="label-text-alt text-gray-500">{t('settings.displayNameHint')}</span>
                            </label>
                        </div>

                        {/* Username */}
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text flex items-center gap-2">
                                    <AtSign className="h-4 w-4" />
                                    {t('settings.username')}
                                </span>
                            </label>
                            <input
                                type="text"
                                value={profileForm.username}
                                onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                                placeholder={t('settings.usernamePlaceholder')}
                                className="input input-bordered w-full"
                                required
                            />
                        </div>

                        {/* Email */}
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    {t('settings.email')}
                                </span>
                            </label>
                            <input
                                type="email"
                                value={profileForm.email}
                                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                placeholder={t('settings.emailPlaceholder')}
                                className="input input-bordered w-full"
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

                {/* Divider */}
                <div className="divider">
                    <Lock className="h-4 w-4" />
                    {t('settings.changePassword')}
                </div>

                {/* Password Change Form */}
                <form onSubmit={handlePasswordSubmit}>
                    <div className="space-y-4">
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">{t('settings.currentPassword')}</span>
                            </label>
                            <input
                                type="password"
                                name="currentPassword"
                                placeholder={t('settings.enterCurrentPassword')}
                                className="input input-bordered w-full"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text">{t('settings.newPassword')}</span>
                                </label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    placeholder={t('settings.enterNewPassword')}
                                    className="input input-bordered w-full"
                                    required
                                />
                            </div>

                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text">{t('settings.confirmNewPassword')}</span>
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    placeholder={t('settings.confirmPassword')}
                                    className="input input-bordered w-full"
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
    );
};

export default ProfileSettings;
