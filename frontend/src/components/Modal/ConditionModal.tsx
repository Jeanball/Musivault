import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Condition grades for media
export const MEDIA_CONDITIONS = [
    { value: 'M', labelKey: 'condition.grades.mint' },
    { value: 'NM', labelKey: 'condition.grades.nearMint' },
    { value: 'VG+', labelKey: 'condition.grades.veryGoodPlus' },
    { value: 'VG', labelKey: 'condition.grades.veryGood' },
    { value: 'G+', labelKey: 'condition.grades.goodPlus' },
    { value: 'G', labelKey: 'condition.grades.good' },
    { value: 'F', labelKey: 'condition.grades.fair' },
    { value: 'P', labelKey: 'condition.grades.poor' },
];

// Condition grades for sleeve (includes additional options)
export const SLEEVE_CONDITIONS = [
    ...MEDIA_CONDITIONS,
    { value: 'Not Graded', labelKey: 'condition.grades.notGraded' },
    { value: 'Generic', labelKey: 'condition.grades.generic' },
    { value: 'No Cover', labelKey: 'condition.grades.noCover' },
];

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
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-semibold">{t('condition.media')}</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
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
                <div className="form-control mb-6">
                    <label className="label">
                        <span className="label-text font-semibold">{t('condition.sleeve')}</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
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
