import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAZ } from 'lucide-react';
import { toastService } from '../../utils/toast';
import { getPreferences, updatePreferences } from '../../api/preferences';

const SortingSettings: React.FC = () => {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getPreferences()
            .then(prefs => {
                setIsEnabled(prefs.sortIgnoreLeadingArticle || false);
            })
            .catch(err => console.error('Failed to fetch preferences:', err))
            .finally(() => setIsLoading(false));
    }, []);

    const handleToggle = async () => {
        const newValue = !isEnabled;
        setIsSaving(true);

        try {
            await updatePreferences({ sortIgnoreLeadingArticle: newValue });
            setIsEnabled(newValue);
            toastService.success(
                newValue
                    ? t('settings.sortIgnoreArticleEnabledToast')
                    : t('settings.sortIgnoreArticleDisabledToast')
            );
        } catch (error) {
            console.error('Failed to update artist sorting setting:', error);
            toastService.error(t('settings.failedUpdateSetting'));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="card bg-base-200 shadow-card">
                <div className="card-body">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="skeleton h-5 w-5 rounded-field"></div>
                        <div className="skeleton h-6 w-48"></div>
                    </div>
                    <div className="skeleton h-4 w-3/4 mb-6"></div>
                    <div className="flex items-center gap-4">
                        <div className="skeleton h-6 w-12 rounded-full"></div>
                        <div className="skeleton h-4 w-32"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card bg-base-200 shadow-card">
            <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                    <ArrowDownAZ size={20} />
                    {t('settings.sortIgnoreArticle')}
                    {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                </h2>
                <p className="text-sm text-base-content/50 mb-4">
                    {t('settings.sortIgnoreArticleDescription')}
                </p>

                <div className="flex flex-col">
                    <label className="label cursor-pointer justify-start gap-4">
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={isEnabled}
                            onChange={handleToggle}
                            disabled={isSaving}
                        />
                        <span className="text-sm">
                            {isEnabled
                                ? t('settings.sortIgnoreArticleEnabled')
                                : t('settings.sortIgnoreArticleDisabled')}
                        </span>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default SortingSettings;
