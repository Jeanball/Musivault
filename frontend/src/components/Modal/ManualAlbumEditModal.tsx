import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ManualAlbumForm from '../Search/ManualAlbumForm';
import type { CollectionItem } from '../../types/collection.types';

interface ManualAlbumEditModalProps {
    item: CollectionItem;
    /** `discogs` edits the user's copy of a Discogs album instead of a manual one. */
    mode?: 'manual' | 'discogs';
    onClose: () => void;
    onSaved: (item: CollectionItem) => void;
}

/**
 * The album form, opened as a modal from the album detail page. Covers every
 * field a hand-added album was created with, plus a replacement cover; in
 * Discogs mode it edits the same fields on the user's own copy.
 */
const ManualAlbumEditModal: React.FC<ManualAlbumEditModalProps> = ({ item, mode = 'manual', onClose, onSaved }) => {
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
                <ManualAlbumForm item={item} mode={mode} onSaved={onSaved} onCancel={onClose} />
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>{t('common.close')}</button>
            </form>
        </dialog>
    );
};

export default ManualAlbumEditModal;
