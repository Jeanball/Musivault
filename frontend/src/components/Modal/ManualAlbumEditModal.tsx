import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ManualAlbumForm from '../Search/ManualAlbumForm';
import type { CollectionItem } from '../../types/collection.types';

interface ManualAlbumEditModalProps {
    item: CollectionItem;
    onClose: () => void;
    onSaved: (item: CollectionItem) => void;
}

/**
 * The manual album form, opened as a modal from the album detail page. Covers
 * every field a hand-added album was created with, plus a replacement cover.
 */
const ManualAlbumEditModal: React.FC<ManualAlbumEditModalProps> = ({ item, onClose, onSaved }) => {
    const { t } = useTranslation();

    return (
        <dialog className="modal modal-open modal-middle px-2 sm:px-4">
            <div className="modal-box max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
                    aria-label={t('common.close')}
                >
                    <X className="w-4 h-4" />
                </button>
                <ManualAlbumForm item={item} onSaved={onSaved} onCancel={onClose} />
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>{t('common.close')}</button>
            </form>
        </dialog>
    );
};

export default ManualAlbumEditModal;
