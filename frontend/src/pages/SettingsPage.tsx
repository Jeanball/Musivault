import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { toastService } from '../utils/toast';
import { useTheme } from '../context/ThemeContext';
import CsvImport from '../components/Settings/CsvImport';

interface VersionInfo {
    version: string;
    buildDate: string;
    commitSha: string;
    environment: string;
}

const themes = [
    "light", "dark"
];

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const [isSaving, setIsSaving] = useState(false);
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

    useEffect(() => {
        axios.get<VersionInfo>('/api/version')
            .then(res => setVersionInfo(res.data))
            .catch(err => console.error('Failed to fetch version:', err));
    }, []);

    const handleThemeChange = async (newTheme: string) => {
        setTheme(newTheme);
        setIsSaving(true);

        try {
            await axios.put('/api/users/preferences', { theme: newTheme }, { withCredentials: true });
            toastService.success('Theme saved!');
        } catch (error) {
            console.error('Failed to save theme to server:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm">
                    ← Back
                </button>
                <h1 className="text-2xl font-bold">Settings</h1>
            </div>

            {/* Theme Section */}
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        Theme
                        {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Choose your preferred color theme. Your choice will be saved to your account.
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
                                {themeOption}
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

            {/* Password Section */}
            <div className="card bg-base-200 shadow-xl mt-6">
                <div className="card-body">
                    <h2 className="card-title flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Change Password
                    </h2>

                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const currentPassword = (form.elements.namedItem('currentPassword') as HTMLInputElement).value;
                        const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
                        const confirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement).value;

                        if (newPassword !== confirmPassword) {
                            toastService.error("New passwords do not match");
                            return;
                        }

                        if (newPassword.length < 6) {
                            toastService.error("Password must be at least 6 characters");
                            return;
                        }

                        try {
                            await axios.put('/api/users/password', { currentPassword, newPassword }, { withCredentials: true });
                            toastService.success('Password updated successfully');
                            form.reset();
                        } catch (error: any) {
                            toastService.error(error.response?.data?.message || 'Failed to update password');
                        }
                    }}>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text">Current Password</span>
                            </label>
                            <input type="password" name="currentPassword" placeholder="Current password" className="input input-bordered w-full" required />
                        </div>

                        <div className="flex gap-4 mt-2">
                            <div className="form-control w-1/2">
                                SettingsPage.tsx
                                Open

                                <label className="label">
                                    <span className="label-text">New Password</span>
                                </label>
                                <input type="password" name="newPassword" placeholder="New password" className="input input-bordered w-full" required />
                            </div>

                            <div className="form-control w-1/2">
                                <label className="label">
                                    <span className="label-text">Confirm New Password</span>
                                </label>
                                <input type="password" name="confirmPassword" placeholder="Confirm new password" className="input input-bordered w-full" required />
                            </div>
                        </div>

                        <div className="card-actions justify-end mt-4">
                            <button type="submit" className="btn btn-primary btn-sm">Update Password</button>
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
                            About Musivault
                        </h2>

                        <div className="stats stats-vertical shadow">
                            <div className="stat">
                                <div className="stat-title">Version</div>
                                <div className="stat-value text-primary text-2xl">v{versionInfo.version}</div>
                                <div className="stat-desc">Current release</div>
                            </div>

                            <div className="stat">
                                <div className="stat-title">Environment</div>
                                <div className="stat-value text-xl capitalize">{versionInfo.environment}</div>
                                <div className="stat-desc">Running mode</div>
                            </div>

                            <div className="stat">
                                <div className="stat-title">Build Date</div>
                                <div className="stat-value text-sm">
                                    {new Date(versionInfo.buildDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </div>
                                <div className="stat-desc">
                                    {new Date(versionInfo.buildDate).toLocaleTimeString()}
                                </div>
                            </div>

                            <div className="stat">
                                <div className="stat-title">Commit</div>
                                <div className="stat-value text-sm font-mono">{versionInfo.commitSha.substring(0, 7)}</div>
                                <div className="stat-desc">Git SHA</div>
                            </div>
                        </div>

                        <div className="text-xs opacity-70 mt-4 text-center">
                            <p>Made with ❤️ by <a href="https://github.com/jeanball" target="_blank" rel="noopener noreferrer">Jeanball</a></p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;

