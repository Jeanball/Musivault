import React from 'react';
import { useTranslation } from 'react-i18next';
import { type FormatDetails } from './AddAlbumVersionModal';
import { getImageUrl } from '../../utils/imageUrl';

interface ConfirmAddModalProps {
    isOpen: boolean;
    coverImage?: string;
    albumTitle?: string;
    format: FormatDetails | null;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmAddModal: React.FC<ConfirmAddModalProps> = ({
    isOpen,
    coverImage,
    albumTitle,
    format,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();

    if (!isOpen || !format) return null;

    return (
        <dialog className="modal modal-open">
            {/* Transparent glassmorphism backdrop */}
            <div className="modal-box w-11/12 max-w-lg">
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                    {/* Album cover */}
                    {coverImage && (
                        <img
                            src={getImageUrl(coverImage)}
                            alt={albumTitle || ''}
                            className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl object-cover shadow-lg flex-shrink-0"
                        />
                    )}

                    <div className="flex-1 min-w-0 mt-2 sm:mt-0 w-full">
                        <h3 className="font-bold text-xl md:text-2xl">{t('versions.confirmAddTitle')}</h3>
                        {albumTitle && (
                            <p className="text-md text-base-content/60 mt-1 line-clamp-2">{albumTitle}</p>
                        )}
                        
                        <div className="mt-4 bg-base-200/50 p-4 rounded-xl border border-base-300 text-left">
                            <p className="text-base-content break-words whitespace-normal text-lg">
                                <span className="font-bold">{format.name}</span>
                                {format.text && <span className="ml-2 text-accent font-semibold">{format.text}</span>}
                            </p>
                            {format.descriptions?.length > 0 && (
                                <p className="text-sm text-base-content/60 mt-1.5 break-words whitespace-normal font-medium">
                                    {format.descriptions.join(', ')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onCancel}>
                        {t('common.cancel')}
                    </button>
                    <button className="btn btn-primary" onClick={onConfirm}>
                        {t('versions.confirmAddYes')}
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onCancel}>{t('common.close')}</button>
            </form>
        </dialog>
    );
};

export default ConfirmAddModal;
