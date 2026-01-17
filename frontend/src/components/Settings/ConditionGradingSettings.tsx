import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toastService } from '../../utils/toast';
import { Star } from 'lucide-react';

interface PreferencesResponse {
    enableConditionGrading: boolean;
}

const ConditionGradingSettings: React.FC = () => {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        axios.get<PreferencesResponse>('/api/users/preferences', { withCredentials: true })
            .then(res => {
                setIsEnabled(res.data.enableConditionGrading || false);
            })
            .catch(err => console.error('Failed to fetch preferences:', err))
            .finally(() => setIsLoading(false));
    }, []);

    const handleToggle = async () => {
        const newValue = !isEnabled;
        setIsSaving(true);

        try {
            await axios.put(
                '/api/users/preferences',
                { enableConditionGrading: newValue },
                { withCredentials: true }
            );
            setIsEnabled(newValue);
            toastService.success(
                newValue
                    ? t('condition.enabledToast')
                    : t('condition.disabledToast')
            );
        } catch (error) {
            console.error('Failed to update condition grading setting:', error);
            toastService.error(t('settings.failedUpdateSetting'));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="skeleton h-5 w-5 rounded"></div>
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
        <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                    <Star size={20} />
                    {t('condition.title')}
                    {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    {t('condition.description')}
                </p>

                <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-4">
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={isEnabled}
                            onChange={handleToggle}
                            disabled={isSaving}
                        />
                        <span className="label-text">
                            {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default ConditionGradingSettings;
