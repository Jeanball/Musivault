import React, { useState } from 'react';

export interface FormatDetails {
    name: string;
    descriptions: string[];
    text: string;
}

export interface AlbumDetails {
    discogsId: number;
    title: string;
    artist: string;
    year: string;
    thumb: string;
    cover_image: string;
    availableFormats?: FormatDetails[]; 
}

interface AlbumDetailModalProps {
    album: AlbumDetails | null;
    onClose: () => void;
    onConfirm: (format: FormatDetails) => void; 
    isSubmitting: boolean;
}

const AlbumDetailModal: React.FC<AlbumDetailModalProps> = ({ album, onClose, onConfirm, isSubmitting }) => {
    const [selectedFormat, setSelectedFormat] = useState<FormatDetails | null>(null);

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
                <div className="divider my-6">Choose your format</div>
                <div className="flex flex-col items-center gap-4">
                    {formats.map((format, index) => (
                        <button
                            key={index}
                            onClick={() => setSelectedFormat(format)}
                            className={`btn btn-block h-auto py-2 ${selectedFormat === format ? 'btn-primary' : 'btn-outline'}`}
                        >
                           <div className="text-left w-full">
                                <div className="font-bold text-lg">{format.name} <span className="text-accent">{format.text}</span></div>
                                <div className="text-xs font-normal opacity-70 normal-case">
                                    {format.descriptions.join(', ')}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="modal-action mt-8">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-success"
                        onClick={handleConfirmClick}
                        disabled={!selectedFormat || isSubmitting}
                    >
                        {isSubmitting ? <span className="loading loading-spinner"></span> : "Add"}
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
