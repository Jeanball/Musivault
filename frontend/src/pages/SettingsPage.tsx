import React, { useState, useEffect } from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toastService } from '../utils/toast';
import { useTheme } from '../context/ThemeContext';
import CsvImport from '../components/Settings/CsvImport';

interface VersionInfo {
    version: string;
    channel?: string;
    buildDate: string;
    commitSha: string;
    environment: string;
}

interface PreferencesResponse {
    theme: string;
    isPublic: boolean;
    publicShareId: string | null;
    language: string;
}

const themes = [
    "light", "dark"
];

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { theme, setTheme, wideScreenMode, setWideScreenMode } = useTheme();
    const [isSaving, setIsSaving] = useState(false);
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [isPublic, setIsPublic] = useState(false);
    const [publicShareId, setPublicShareId] = useState<string | null>(null);

    const languages = [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
        { code: 'de', label: 'Deutsch' },
        { code: 'es', label: 'Español' },
        { code: 'pt', label: 'Português' },
        { code: 'zh', label: '中文 (Simplified)' },
    ];

    const handleLanguageChange = async (lng: string) => {
        await i18n.changeLanguage(lng);
        localStorage.setItem('i18nextLng', lng);
        setIsSaving(true);
        try {
            await axios.put('/api/users/preferences', { language: lng }, { withCredentials: true });
            const tNew = i18n.getFixedT(lng);
            toastService.success(tNew('settings.languageSaved', 'Language saved!'));
        } catch (error) {
            console.error('Failed to save language to server:', error);
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        axios.get<VersionInfo>('/api/version')
            .then(res => setVersionInfo(res.data))
            .catch(err => console.error('Failed to fetch version:', err));

        // Fetch public collection preferences
        axios.get<PreferencesResponse>('/api/users/preferences', { withCredentials: true })
            .then(res => {
                setIsPublic(res.data.isPublic || false);
                setPublicShareId(res.data.publicShareId || null);
                if (res.data.language && res.data.language !== i18n.language) {
                    i18n.changeLanguage(res.data.language);
                }
            })
            .catch(err => console.error('Failed to fetch preferences:', err));
    }, []);

    const handleThemeChange = async (newTheme: string) => {
        setTheme(newTheme);
        setIsSaving(true);

        try {
            await axios.put('/api/users/preferences', { theme: newTheme }, { withCredentials: true });
            toastService.success(t('settings.themeSaved'));
        } catch (error) {
            console.error('Failed to save theme to server:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleWideScreenModeChange = async () => {
        const newValue = !wideScreenMode;
        setWideScreenMode(newValue);
        setIsSaving(true);

        try {
            await axios.put('/api/users/preferences', { wideScreenMode: newValue }, { withCredentials: true });
            toastService.success(newValue ? t('settings.wideScreenModeEnabled') : t('settings.wideScreenModeDisabled'));
        } catch (error) {
            console.error('Failed to save wide screen mode to server:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublicToggle = async () => {
        const newValue = !isPublic;
        setIsSaving(true);

        try {
            const response = await axios.put<{ preferences: PreferencesResponse; publicShareId: string | null }>(
                '/api/users/preferences',
                { isPublic: newValue },
                { withCredentials: true }
            );
            setIsPublic(newValue);
            setPublicShareId(response.data.publicShareId);
            toastService.success(newValue ? t('settings.collectionNowPublic') : t('settings.collectionNowPrivate'));
        } catch (error) {
            console.error('Failed to update public setting:', error);
            toastService.error(t('settings.failedUpdateSetting'));
        } finally {
            setIsSaving(false);
        }
    };

    const copyShareLink = () => {
        if (publicShareId) {
            const shareUrl = `${window.location.origin}/collection/${publicShareId}`;
            navigator.clipboard.writeText(shareUrl);
            toastService.success(t('settings.linkCopied'));
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm gap-2">
                    <ArrowLeft size={16} /> {t('common.back')}
                </button>
                <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
            </div>

            {/* Theme Section */}
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        {t('settings.theme')}
                        {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        {t('settings.themeDescription')}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {themes.map((themeOption) => (
                            <button
                                key={themeOption}
                                onClick={() => handleThemeChange(themeOption)}
                                className={`btn btn-sm capitalize ${theme === themeOption
                                    ? 'btn-primary'
                                    : 'btn-outline'
                                    }`}
                            >
                                {t(`settings.themes.${themeOption}`)}
                                {theme === themeOption && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Language Section */}
            <div className="card bg-base-200 shadow-xl mt-6">
                <div className="card-body">
                    <h2 className="card-title flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                        {t('settings.language')}
                        {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        {t('settings.languageDescription')}
                    </p>

                    <select
                        className="select select-bordered w-full max-w-xs"
                        value={languages.some(l => l.code === i18n.language) ? i18n.language : i18n.language.substring(0, 2)}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        disabled={isSaving}
                    >
                        {languages.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                                {lang.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Display Section */}
            <div className="card bg-base-200 shadow-xl mt-6">
                <div className="card-body">
                    <h2 className="card-title flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {t('settings.display')}
                        {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        {t('settings.displayDescription')}
                    </p>

                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4">
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={wideScreenMode}
                                onChange={handleWideScreenModeChange}
                                disabled={isSaving}
                            />
                            <div>
                                <span className="label-text font-medium">{t('settings.wideScreenMode')}</span>
                                <p className="text-xs text-gray-500 mt-1">
                                    {wideScreenMode
                                        ? t('settings.wideScreenEnabled')
                                        : t('settings.wideScreenDisabled')}
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Public Collection Section */}
            <div className="card bg-base-200 shadow-xl mt-6">
                <div className="card-body">
                    <h2 className="card-title flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('settings.publicCollection')}
                        {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        {t('settings.publicCollectionDescription')}
                    </p>

                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-4">
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={isPublic}
                                onChange={handlePublicToggle}
                                disabled={isSaving}
                            />
                            <span className="label-text">
                                {isPublic ? t('settings.collectionPublic') : t('settings.collectionPrivate')}
                            </span>
                        </label>
                    </div>

                    {isPublic && publicShareId && (
                        <div className="mt-4 p-4 bg-base-300 rounded-lg">
                            <p className="text-sm font-medium mb-2">{t('settings.shareLink')}</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={`${window.location.origin}/collection/${publicShareId}`}
                                    readOnly
                                    className="input input-bordered input-sm flex-1 font-mono text-xs"
                                />
                                <button
                                    onClick={copyShareLink}
                                    className="btn btn-sm btn-primary"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                    </svg>
                                    {t('settings.copy')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Password Section */}
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

                    <form onSubmit={async (e) => {
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
                    }}>
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

            {/* Import CSV Section */}
            <div className="mt-6">
                <CsvImport />
            </div>

            {/* About Section */}
            {versionInfo && (
                <div className="card bg-base-200 shadow-xl mt-6">
                    <div className="card-body">
                        <h2 className="card-title flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('settings.about')}
                        </h2>

                        <div className="stats stats-vertical shadow">
                            <div className="stat">
                                <div className="stat-title">{t('settings.version')}</div>
                                <div className="stat-value text-primary text-2xl">
                                    v{versionInfo.version}
                                    {versionInfo.channel && !['latest', 'stable', ''].includes(versionInfo.channel) && (
                                        <span className="text-warning text-base ml-2">({versionInfo.channel})</span>
                                    )}
                                </div>
                                <div className="stat-desc">{t('settings.currentRelease')}</div>
                            </div>

                            <div className="stat">
                                <div className="stat-title">{t('settings.environment')}</div>
                                <div className="stat-value text-xl capitalize">{versionInfo.environment}</div>
                                <div className="stat-desc">{t('settings.runningMode')}</div>
                            </div>

                            <div className="stat">
                                <div className="stat-title">{t('settings.buildDate')}</div>
                                <div className="stat-value text-sm">
                                    {new Date(versionInfo.buildDate).toLocaleDateString(i18n.language, {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </div>
                                <div className="stat-desc">
                                    {new Date(versionInfo.buildDate).toLocaleTimeString(i18n.language)}
                                </div>
                            </div>

                            <div className="stat">
                                <div className="stat-title">{t('settings.commit')}</div>
                                <div className="stat-value text-sm font-mono">{versionInfo.commitSha.substring(0, 7)}</div>
                                <div className="stat-desc">{t('settings.gitSha')}</div>
                            </div>
                        </div>

                        <div className="text-xs opacity-70 mt-4 text-center">
                            <div className="text-xs opacity-70 mt-4 text-center flex justify-center items-center gap-1">
                                {t('settings.madeWith')} <Heart size={12} className="text-error" fill="currentColor" /> {t('settings.by')} <a href="https://github.com/jeanball" target="_blank" rel="noopener noreferrer" className="link link-hover">Jeanball</a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;

