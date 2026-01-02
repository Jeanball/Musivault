import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
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
}

const themes = [
    "light", "dark"
];

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { theme, setTheme, wideScreenMode, setWideScreenMode } = useTheme();
    const [isSaving, setIsSaving] = useState(false);
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [isPublic, setIsPublic] = useState(false);
    const [publicShareId, setPublicShareId] = useState<string | null>(null);

    useEffect(() => {
        axios.get<VersionInfo>('/api/version')
            .then(res => setVersionInfo(res.data))
            .catch(err => console.error('Failed to fetch version:', err));

        // Fetch public collection preferences
        axios.get<PreferencesResponse>('/api/users/preferences', { withCredentials: true })
            .then(res => {
                setIsPublic(res.data.isPublic || false);
                setPublicShareId(res.data.publicShareId || null);
            })
            .catch(err => console.error('Failed to fetch preferences:', err));
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

    const handleWideScreenModeChange = async () => {
        const newValue = !wideScreenMode;
        setWideScreenMode(newValue);
        setIsSaving(true);

        try {
            await axios.put('/api/users/preferences', { wideScreenMode: newValue }, { withCredentials: true });
            toastService.success(newValue ? 'Wide screen mode enabled!' : 'Wide screen mode disabled');
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
            toastService.success(newValue ? 'Collection is now public!' : 'Collection is now private');
        } catch (error) {
            console.error('Failed to update public setting:', error);
            toastService.error('Failed to update setting');
        } finally {
            setIsSaving(false);
        }
    };

    const copyShareLink = () => {
        if (publicShareId) {
            const shareUrl = `${window.location.origin}/collection/${publicShareId}`;
            navigator.clipboard.writeText(shareUrl);
            toastService.success('Link copied to clipboard!');
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

            {/* Display Section */}
            <div className="card bg-base-200 shadow-xl mt-6">
                <div className="card-body">
                    <h2 className="card-title flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Display
                        {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Customize how the interface is displayed.
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
                                <span className="label-text font-medium">Wide Screen Mode</span>
                                <p className="text-xs text-gray-500 mt-1">
                                    {wideScreenMode
                                        ? 'Content is centered with a maximum width for easier reading'
                                        : 'Content expands to fill the entire screen width'}
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
                        Public Collection
                        {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Allow anyone with the link to view your collection. Your collection is private by default.
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
                                {isPublic ? 'Collection is public' : 'Collection is private'}
                            </span>
                        </label>
                    </div>

                    {isPublic && publicShareId && (
                        <div className="mt-4 p-4 bg-base-300 rounded-lg">
                            <p className="text-sm font-medium mb-2">Share Link:</p>
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
                                    Copy
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
                        Change Password
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Update your password to keep your account secure.
                    </p>

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
                        <div className="space-y-4">
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text">Current Password</span>
                                </label>
                                <input
                                    type="password"
                                    name="currentPassword"
                                    placeholder="Enter current password"
                                    className="input input-bordered w-full"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="form-control w-full">
                                    <label className="label">
                                        <span className="label-text">New Password</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="newPassword"
                                        placeholder="Enter new password"
                                        className="input input-bordered w-full"
                                        required
                                    />
                                </div>

                                <div className="form-control w-full">
                                    <label className="label">
                                        <span className="label-text">Confirm New Password</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        placeholder="Confirm new password"
                                        className="input input-bordered w-full"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="card-actions justify-end mt-6">
                            <button type="submit" className="btn btn-primary">
                                Update Password
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
                            About Musivault
                        </h2>

                        <div className="stats stats-vertical shadow">
                            <div className="stat">
                                <div className="stat-title">Version</div>
                                <div className="stat-value text-primary text-2xl">
                                    v{versionInfo.version}
                                    {versionInfo.channel && !['latest', 'stable', ''].includes(versionInfo.channel) && (
                                        <span className="text-warning text-base ml-2">({versionInfo.channel})</span>
                                    )}
                                </div>
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

