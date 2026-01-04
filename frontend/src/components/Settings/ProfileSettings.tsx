import React from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toastService } from '../../utils/toast';

const ProfileSettings: React.FC = () => {
    const { t } = useTranslation();

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
        <div className="card bg-base-200 shadow-xl mt-6">
            <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {t('settings.changePassword')}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    {t('settings.changePasswordDescription')}
                </p>

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
