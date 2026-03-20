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
                <div className="flex gap-4 items-start">
                    {/* Album cover */}
                    {coverImage && (
                        <img
                            src={getImageUrl(coverImage)}
                            alt={albumTitle || ''}
                            className="w-20 h-20 rounded-lg object-cover shadow-md flex-shrink-0"
                        />
                    )}

                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg">{t('versions.confirmAddTitle')}</h3>
                        {albumTitle && (
                            <p className="text-sm text-base-content/60 mt-0.5 truncate">{albumTitle}</p>
                        )}
                        <div className="mt-2">
                            <p className="text-base-content/80 break-words whitespace-normal">
                                <span className="font-semibold">{format.name}</span>
                                {format.text && <span className="ml-1 text-accent">{format.text}</span>}
                            </p>
                            {format.descriptions?.length > 0 && (
                                <p className="text-sm text-base-content/50 mt-0.5 break-words whitespace-normal">
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
