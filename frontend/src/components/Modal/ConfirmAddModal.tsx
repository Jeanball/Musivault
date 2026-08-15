import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type FormatDetails } from '../../types/album.types';
import type { ConditionPrices } from '../../types/collection.types';
import { MEDIA_CONDITIONS, SLEEVE_CONDITIONS } from '../../utils/conditions';
import { getImageUrl } from '../../utils/imageUrl';
import ReleasePrice from '../Price/ReleasePrice';

interface ConfirmAddModalProps {
    isOpen: boolean;
    coverImage?: string;
    albumTitle?: string;
    format: FormatDetails | null;
    price: ConditionPrices | null;
    isPriceLoading: boolean;
    /** Grading is a user preference: without it the album is added ungraded. */
    conditionGradingEnabled: boolean;
    onConfirm: (mediaCondition: string | null, sleeveCondition: string | null) => void;
    onCancel: () => void;
}

const ConfirmAddModal: React.FC<ConfirmAddModalProps> = ({
    isOpen,
    coverImage,
    albumTitle,
    format,
    price,
    isPriceLoading,
    conditionGradingEnabled,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    const [mediaCondition, setMediaCondition] = useState<string>('');
    const [sleeveCondition, setSleeveCondition] = useState<string>('');

    if (!isOpen || !format) return null;

    // Reset for next use, the modal keeps its state while it stays mounted.
    const clearConditions = () => {
        setMediaCondition('');
        setSleeveCondition('');
    };

    const handleConfirm = () => {
        onConfirm(mediaCondition || null, sleeveCondition || null);
        clearConditions();
    };

    const handleCancel = () => {
        onCancel();
        clearConditions();
    };

    return (
        <dialog className="modal modal-open">
            {/* Transparent glassmorphism backdrop */}
            <div className="modal-box w-11/12 max-w-lg">
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                    {/* Album cover, with the rough market value tucked under it */}
                    {coverImage && (
                        <div className="shrink-0 w-32 sm:w-40">
                            <img
                                src={getImageUrl(coverImage)}
                                alt={albumTitle || ''}
                                className="w-32 h-32 sm:w-40 sm:h-40 rounded-box object-cover shadow-card"
                            />
                            <ReleasePrice
                                price={price}
                                isLoading={isPriceLoading}
                                condition={mediaCondition}
                            />
                        </div>
                    )}

                    <div className="flex-1 min-w-0 mt-2 sm:mt-0 w-full">
                        <h3 className="font-bold text-xl md:text-2xl">{t('versions.confirmAddTitle')}</h3>
                        {albumTitle && (
                            <p className="text-base text-base-content/60 mt-1 line-clamp-2">{albumTitle}</p>
                        )}

                        <div className="mt-4 bg-base-200/50 p-4 rounded-box border border-base-300 text-left">
                            <p className="text-base-content wrap-break-word whitespace-normal text-lg">
                                <span className="font-bold">{format.name}</span>
                                {format.text && <span className="ml-2 text-accent font-semibold">{format.text}</span>}
                            </p>
                            {format.descriptions?.length > 0 && (
                                <p className="text-sm text-base-content/60 mt-1.5 wrap-break-word whitespace-normal font-medium">
                                    {format.descriptions.join(', ')}
                                </p>
                            )}
                        </div>

                        {conditionGradingEnabled && (
                            <div className="mt-4 flex flex-col sm:flex-row gap-3 text-left">
                                <label className="flex-1 flex flex-col gap-1">
                                    <span className="text-sm font-semibold">{t('condition.media')}</span>
                                    <select
                                        className="select select-sm w-full"
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
                                </label>

                                <label className="flex-1 flex flex-col gap-1">
                                    <span className="text-sm font-semibold">{t('condition.sleeve')}</span>
                                    <select
                                        className="select select-sm w-full"
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
                                </label>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={handleCancel}>
                        {t('common.cancel')}
                    </button>
                    <button className="btn btn-primary" onClick={handleConfirm}>
                        {t('versions.confirmAddYes')}
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={handleCancel}>{t('common.close')}</button>
            </form>
        </dialog>
    );
};

export default ConfirmAddModal;
