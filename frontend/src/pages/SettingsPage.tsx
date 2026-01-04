import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import AppearanceSettings from '../components/Settings/AppearanceSettings';
import CollectionSettings from '../components/Settings/CollectionSettings';
import ProfileSettings from '../components/Settings/ProfileSettings';
import AboutSettings from '../components/Settings/AboutSettings';
import ImportSettings from '../components/Settings/ImportSettings';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm gap-2">
                    <ArrowLeft size={16} /> {t('common.back')}
                </button>
                <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
            </div>

            {/* Appearance: Theme, Language, Display */}
            <AppearanceSettings />

            {/* Public Collection */}
            <CollectionSettings />

            {/* Password */}
            <ProfileSettings />

            {/* Import CSV Section */}
            <div className="mt-6">
                <ImportSettings />
            </div>

            {/* About */}
            <AboutSettings />
        </div>
    );
};

export default SettingsPage;
