import React from 'react'
import type { CollectionItem } from '../../pages/CollectionPage';

interface AlbumDetailModalProps {
    item: CollectionItem | null;
    onClose: () => void;
    onDelete: (itemId: string) => void;
    isDeleting: boolean;
}

const ShowAlbumModal: React.FC<AlbumDetailModalProps> = ({ item, onClose, onDelete, isDeleting }) => {
    if (!item) return null;

    return (
<dialog id="collection_item_modal" className="modal" open={!!item}>
            <div className="modal-box w-11/12 max-w-2xl">
                <div className="flex flex-col sm:flex-row gap-6">
                    <img src={item.album.cover_image} alt={item.album.title} className="w-48 h-48 object-cover rounded-lg shadow-lg mx-auto sm:mx-0" />
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold">{item.album.title}</h3>
                        <p className="text-lg text-gray-400 mt-1">{item.album.artist}</p>
                        <p className="text-sm text-gray-500">Released in {item.album.year}</p>
                        <div className="divider my-2"></div>
                        <div className="text-sm space-y-1">
                            <p><strong>Format :</strong> {item.format.name}</p>
                            {item.format.text && <p><strong>Version :</strong> {item.format.text}</p>}
                            {item.format.descriptions?.length > 0 && <p><strong>Détails :</strong> {item.format.descriptions.join(', ')}</p>}
                        </div>
                    </div>
                </div>

                <div className="modal-action mt-6">
                    <button className="btn btn-ghost" onClick={onClose}>Close</button>
                    <button className="btn btn-error" onClick={() => onDelete(item._id)} disabled={isDeleting}>
                        {isDeleting ? <span className="loading loading-spinner"></span> : "Delete"}
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
  )
}

export default ShowAlbumModal