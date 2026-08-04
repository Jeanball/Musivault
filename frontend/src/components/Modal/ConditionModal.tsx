import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MEDIA_CONDITIONS, SLEEVE_CONDITIONS } from '../../utils/conditions';

interface ConditionModalProps {
    isOpen: boolean;
    albumTitle: string;
    onSkip: () => void;
    onConfirm: (mediaCondition: string | null, sleeveCondition: string | null) => void;
}

const ConditionModal: React.FC<ConditionModalProps> = ({
    isOpen,
    albumTitle,
    onSkip,
    onConfirm,
}) => {
    const { t } = useTranslation();
    const [mediaCondition, setMediaCondition] = useState<string>('');
    const [sleeveCondition, setSleeveCondition] = useState<string>('');

    if (!isOpen) {
        return null;
    }

    const handleConfirm = () => {
        onConfirm(
            mediaCondition || null,
            sleeveCondition || null
        );
        // Reset for next use
        setMediaCondition('');
        setSleeveCondition('');
    };

    const handleSkip = () => {
        onSkip();
        // Reset for next use
        setMediaCondition('');
        setSleeveCondition('');
    };

    return (
        <dialog className="modal modal-open">
            <div className="modal-box w-11/12 max-w-lg">
                <h3 className="font-bold text-xl mb-2">{t('condition.setCondition')}</h3>
                <p className="text-base-content/70 mb-6 text-sm">
                    {albumTitle}
                </p>

                {/* Media Condition */}
                <div className="flex flex-col mb-4">
                    <label className="label">
                        <span className="text-sm font-semibold">{t('condition.media')}</span>
                    </label>
                    <select
                        className="select w-full"
                        value={mediaCondition}
                        onChange={(e) => setMediaCondition(e.target.value)}
                    >
                        <option value="">{t('condition.grades.none')}</option>
                        {MEDIA_CONDITIONS.map((cond) => (
                            <option key={cond.value} value={cond.value}>
                                {t(cond.labelKey)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Sleeve Condition */}
                <div className="flex flex-col mb-6">
                    <label className="label">
                        <span className="text-sm font-semibold">{t('condition.sleeve')}</span>
                    </label>
                    <select
                        className="select w-full"
                        value={sleeveCondition}
                        onChange={(e) => setSleeveCondition(e.target.value)}
                    >
                        <option value="">{t('condition.grades.none')}</option>
                        {SLEEVE_CONDITIONS.map((cond) => (
                            <option key={cond.value} value={cond.value}>
                                {t(cond.labelKey)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={handleSkip}>
                        {t('condition.skip')}
                    </button>
                    <button className="btn btn-primary" onClick={handleConfirm}>
                        {t('common.confirm')}
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={handleSkip}>close</button>
            </form>
        </dialog>
    );
};

export default ConditionModal;
