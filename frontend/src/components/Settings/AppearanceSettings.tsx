import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toastService } from '../../utils/toast';
import { useTheme } from '../../context/ThemeContext';

const themes = ["light", "dark"];

const languages = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' },
    { code: 'pt', label: 'Português' },
    { code: 'zh', label: '中文 (Simplified)' },
];

const AppearanceSettings: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { theme, setTheme, wideScreenMode, setWideScreenMode } = useTheme();
    const [isSaving, setIsSaving] = useState(false);

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

    return (
        <>
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
            <div className="card bg-base-200 shadow-xl">
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
            <div className="card bg-base-200 shadow-xl">
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
        </>
    );
};

export default AppearanceSettings;
