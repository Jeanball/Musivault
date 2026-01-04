import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toastService } from '../../utils/toast';

interface PreferencesResponse {
    theme: string;
    isPublic: boolean;
    publicShareId: string | null;
    language: string;
}

const CollectionSettings: React.FC = () => {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [publicShareId, setPublicShareId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        axios.get<PreferencesResponse>('/api/users/preferences', { withCredentials: true })
            .then(res => {
                setIsPublic(res.data.isPublic || false);
                setPublicShareId(res.data.publicShareId || null);
            })
            .catch(err => console.error('Failed to fetch preferences:', err))
            .finally(() => setIsLoading(false));
    }, []);

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
    );
};

export default CollectionSettings;
