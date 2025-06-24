import React, { useState } from 'react';


export interface AlbumDetails {
    discogsId: number;
    title: string;
    artist: string;
    year: string;
    thumb: string;
    cover_image: string;
    availableFormats?: string[];
}

interface AlbumDetailModalProps {
    album: AlbumDetails | null;
    onClose: () => void;
    onConfirm: (format: string) => void;
    isSubmitting: boolean;
}

const AlbumDetailModal: React.FC<AlbumDetailModalProps> = ({ album, onClose, onConfirm, isSubmitting }) => {
    const [selectedFormat, setSelectedFormat] = useState<string>('');

    if (!album) {
        return null;
    }

    const handleConfirmClick = () => {
        if (selectedFormat) {
            onConfirm(selectedFormat);
        }
    };

    const formats = album.availableFormats || [];

     return (
        <dialog id="album_detail_modal" className="modal" open={!!album}>
            <div className="modal-box w-11/12 max-w-2xl">
                <div className="flex flex-col sm:flex-row gap-6">
                    <img src={album.cover_image} alt={`Pochette de ${album.title}`} className="w-48 h-48 object-cover rounded-lg shadow-lg mx-auto sm:mx-0" />
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold">{album.title}</h3>
                        <p className="text-lg text-gray-400 mt-1">{album.artist}</p>
                        <p className="text-sm text-gray-500">{album.year}</p>
                    </div>
                </div>
                <div className="divider my-6">Choisissez votre format</div>
                <div className="flex flex-wrap justify-center gap-3">
                    {formats.length > 0 ? (
                        formats.map((format) => (
                            <button
                                key={format}
                                onClick={() => setSelectedFormat(format)}
                                className={`btn ${selectedFormat === format ? 'btn-primary' : 'btn-outline'}`}
                            >
                                {format}
                            </button>
                        ))
                    ) : (
                        <p className="text-gray-500">Aucun format spécifique trouvé.</p>
                    )}
                </div>
                <div className="modal-action mt-8">
                    <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
                    <button
                        className="btn btn-success"
                        onClick={handleConfirmClick}
                        disabled={!selectedFormat || isSubmitting}
                    >
                        {isSubmitting ? <span className="loading loading-spinner"></span> : "Ajouter"}
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    );
};

export default AlbumDetailModal;
