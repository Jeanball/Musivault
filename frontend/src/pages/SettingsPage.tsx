import React, { useState } from 'react';
import { ArrowLeft, User, Settings, Upload, Info } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import ProfileSettings from '../components/Settings/ProfileSettings';
import PreferencesSettings from '../components/Settings/PreferencesSettings';
import AboutSettings from '../components/Settings/AboutSettings';
import ImportSettings from '../components/Settings/ImportSettings';

type SettingsSection = 'profile' | 'preferences' | 'import' | 'about';

interface MenuItem {
    id: SettingsSection;
    labelKey: string;
    icon: React.ReactNode;
}

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
    const [showMobileMenu, setShowMobileMenu] = useState(true);

    const menuItems: MenuItem[] = [
        { id: 'profile', labelKey: 'settings.profile', icon: <User size={18} /> },
        { id: 'preferences', labelKey: 'settings.preferences', icon: <Settings size={18} /> },
        { id: 'import', labelKey: 'settings.import', icon: <Upload size={18} /> },
        { id: 'about', labelKey: 'settings.about', icon: <Info size={18} /> },
    ];

    const renderContent = () => {
        switch (activeSection) {
            case 'profile':
                return <ProfileSettings />;
            case 'preferences':
                return <PreferencesSettings />;
            case 'import':
                return <ImportSettings />;
            case 'about':
                return <AboutSettings />;
            default:
                return <ProfileSettings />;
        }
    };

    const handleBack = () => {
        // Check if we are on mobile (using standard md breakpoint logic)
        // If on mobile and showing content, go back to menu
        if (window.innerWidth < 768 && !showMobileMenu) {
            setShowMobileMenu(true);
        } else {
            // Otherwise go back to previous page
            navigate(-1);
        }
    };

    const handleMobileMenuClick = (id: SettingsSection) => {
        setActiveSection(id);
        setShowMobileMenu(false);
    };

    const activeItemLabel = menuItems.find(i => i.id === activeSection)?.labelKey || 'settings.title';

    return (
        <div className="w-full max-w-4xl mx-auto px-0 md:px-0">
            {/* Mobile Header (Hidden on Desktop) */}
            <div className="flex md:hidden items-center gap-2 mb-4">
                <button onClick={handleBack} className="btn btn-ghost btn-sm gap-1">
                    <ArrowLeft size={16} />
                    <span className="hidden sm:inline">{t('common.back')}</span>
                </button>
                <h1 className="text-xl font-bold flex-1 truncate">
                    {showMobileMenu ? t('settings.title') : t(activeItemLabel)}
                </h1>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex gap-6">
                {/* Sidebar Menu Column */}
                <div className="w-56 shrink-0">
                    {/* Back Button (Aligned with Sidebar) */}
                    <div className="mb-8 flex items-center h-9">
                        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm gap-2 -ml-3">
                            <ArrowLeft size={16} /> {t('common.back')}
                        </button>
                    </div>

                    <ul className="menu bg-base-200 rounded-box p-2">
                        {menuItems.map((item) => (
                            <li key={item.id}>
                                <button
                                    onClick={() => setActiveSection(item.id)}
                                    className={`flex items-center gap-3 ${activeSection === item.id ? 'active' : ''}`}
                                >
                                    {item.icon}
                                    {t(item.labelKey)}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Content Area Column */}
                <div className="flex-1 min-w-0">
                    {/* Desktop Header (Title only, aligned with Content) */}
                    <div className="mb-8 flex items-center h-9">
                        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
                    </div>

                    {renderContent()}
                </div>
            </div>

            {/* Mobile Layout (Hidden on Desktop) */}
            <div className="md:hidden">
                {showMobileMenu ? (
                    /* Mobile Menu Grid */
                    <div className="grid grid-cols-2 gap-4 p-2">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleMobileMenuClick(item.id)}
                                className="card bg-base-200 shadow-sm active:shadow-inner active:scale-95 transition-all aspect-square flex flex-col items-center justify-center gap-3 p-4 hover:bg-base-300"
                            >
                                <span className="bg-base-100 p-4 rounded-full text-primary shadow-sm">
                                    {React.cloneElement(item.icon as React.ReactElement, { size: 32 } as any)}
                                </span>
                                <span className="font-bold text-lg text-center leading-tight">{t(item.labelKey)}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    /* Mobile Content View */
                    <div className="w-full animate-in fade-in slide-in-from-right-4 duration-200">
                        {renderContent()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
