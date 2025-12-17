import React from 'react';
import type { CollectionItem } from '../../types/collection';

interface PublicAlbumModalProps {
    item: CollectionItem | null;
    onClose: () => void;
}

const PublicAlbumModal: React.FC<PublicAlbumModalProps> = ({ item, onClose }) => {
    if (!item) return null;

    const album = item.album;
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(`${album.artist} ${album.title}`)}`;
    const discogsUrl = album.discogsId ? `https://www.discogs.com/release/${album.discogsId}` : null;

    return (
        <dialog className="modal modal-middle px-4" open={!!item}>
            <div className="modal-box max-w-md w-full">
                {/* Close button */}
                <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
                    ✕
                </button>

                {/* Album Cover */}
                <div className="flex justify-center mb-4">
                    <img
                        src={album.cover_image || '/placeholder-album.png'}
                        alt={album.title}
                        className="w-48 h-48 object-cover rounded-lg shadow-xl"
                    />
                </div>

                {/* Album Info */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold">{album.title}</h2>
                    <p className="text-lg text-base-content/70">{album.artist}</p>
                    <p className="text-sm text-base-content/50 mt-1">
                        {album.year || '—'} • {item.format.name}
                    </p>
                </div>

                {/* External Links */}
                <div className="flex flex-col gap-2">
                    <a
                        href={spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-success w-full"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                        Listen on Spotify
                    </a>
                    {discogsUrl && (
                        <a
                            href={discogsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline w-full"
                        >
                            View on Discogs
                        </a>
                    )}
                    <button onClick={onClose} className="btn btn-ghost w-full">
                        Close
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    );
};

export default PublicAlbumModal;
