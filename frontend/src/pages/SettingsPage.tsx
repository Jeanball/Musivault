import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTheme } from '../context/ThemeContext';
import CsvImport from '../components/Settings/CsvImport';

const themes = [
    "light", "dark"
];

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const [isSaving, setIsSaving] = useState(false);

    const handleThemeChange = async (newTheme: string) => {
        setTheme(newTheme);
        setIsSaving(true);

        try {
            await axios.put('/api/users/preferences', { theme: newTheme }, { withCredentials: true });
            toast.success('Theme saved!');
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

            {/* Import CSV Section */}
            <div className="mt-6">
                <CsvImport />
            </div>
        </div>
    );
};

export default SettingsPage;

