import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

interface VersionInfo {
    version: string;
    channel?: string;
    buildDate: string;
    commitSha: string;
    environment: string;
}

const AboutSettings: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

    useEffect(() => {
        axios.get<VersionInfo>('/api/version')
            .then(res => setVersionInfo(res.data))
            .catch(err => console.error('Failed to fetch version:', err));
    }, []);

    if (!versionInfo) {
        return null;
    }

    return (
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
    );
};

export default AboutSettings;
