import React from 'react';
import { useTranslation } from 'react-i18next';
import { Disc3, Check, X } from 'lucide-react';
import axios from 'axios';
import { toastService } from '../../utils/toast';

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    username: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, username }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const handleGetStarted = async () => {
        try {
            await axios.put(
                `${API_BASE_URL}/api/users/preferences`,
                { hasSeenWelcome: true },
                { withCredentials: true }
            );
            onClose();
            toastService.success(t('welcome.enjoy'));
        } catch (error) {
            console.error('Failed to update welcome status', error);
            // Close anyway to not block the user
            onClose();
        }
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box relative border border-primary/20 bg-base-100 shadow-2xl max-w-lg">
                <button
                    onClick={handleGetStarted}
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center text-center p-4">
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
                        <Disc3 className="w-10 h-10 animate-spin-slow" />
                    </div>

                    <h2 className="text-3xl font-bold mb-2">
                        {t('welcome.title', { username })}
                    </h2>

                    <p className="text-lg text-gray-400 mb-8">
                        {t('welcome.subtitle')}
                    </p>

                    <div className="stats stats-vertical lg:stats-horizontal shadow w-full mb-8 bg-base-200/50">
                        <div className="stat place-items-center p-4">
                            <div className="stat-value text-primary text-2xl">1</div>
                            <div className="stat-desc font-medium mt-1">{t('welcome.step1')}</div>
                        </div>

                        <div className="stat place-items-center p-4">
                            <div className="stat-value text-primary text-2xl">2</div>
                            <div className="stat-desc font-medium mt-1">{t('welcome.step2')}</div>
                        </div>

                        <div className="stat place-items-center p-4">
                            <div className="stat-value text-primary text-2xl">3</div>
                            <div className="stat-desc font-medium mt-1">{t('welcome.step3')}</div>
                        </div>
                    </div>

                    <button
                        onClick={handleGetStarted}
                        className="btn btn-primary btn-lg w-full gap-2 shadow-lg hover:shadow-primary/20 transition-all"
                    >
                        {t('welcome.getStarted')}
                        <Check className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop bg-black/60 backdrop-blur-sm">
                <button onClick={handleGetStarted}>close</button>
            </form>
        </div>
    );
};

export default WelcomeModal;
