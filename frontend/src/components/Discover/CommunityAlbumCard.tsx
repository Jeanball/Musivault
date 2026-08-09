import React from 'react';
import { Link } from 'react-router';
import { getImageUrl } from '../../utils/imageUrl';
import { revealIfCached } from '../../utils/imageReveal';
import type { CommunityAlbum } from '../../types/public.types';

interface CommunityAlbumCardProps {
    item: CommunityAlbum;
    onSelect: (item: CommunityAlbum) => void;
}

/**
 * One recent addition from somebody else's public collection.
 *
 * The tile answers two different curiosities without making you pick first: the
 * record opens its detail modal, the collector's name opens their shelf.
 */
const CommunityAlbumCard: React.FC<CommunityAlbumCardProps> = ({ item, onSelect }) => {
    const album = item.album;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(item)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(item);
                }
            }}
            className="card bg-base-100 shadow-xs hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
        >
            <figure className="aspect-square relative overflow-hidden rounded-t-xl bg-base-300">
                {/* Sits behind the cover so the tile is never an empty hole while loading. */}
                <img
                    src="/placeholder-album.svg"
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                />
                <img
                    ref={revealIfCached}
                    src={getImageUrl(album?.cover_image || '/placeholder-album.svg')}
                    alt={album?.title}
                    loading="lazy"
                    decoding="async"
                    className="object-cover w-full h-full relative z-1 opacity-0 transition-opacity duration-300"
                    onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/placeholder-album.svg';
                    }}
                />
                {/* Readability scrim behind the owner's name. */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/70 to-transparent pointer-events-none z-2" />
                <Link
                    to={`/shared/${item.user.publicShareId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-1 left-1.5 right-1.5 z-3 flex items-center gap-1 text-[10px] font-medium text-white drop-shadow-sm hover:underline"
                >
                    <span className="size-3.5 shrink-0 rounded-full bg-white/90 text-black text-[8px] font-bold grid place-items-center">
                        {item.user.username.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{item.user.username}</span>
                </Link>
            </figure>
            <div className="card-body p-2 gap-0.5">
                <h3 className="card-title text-xs leading-tight truncate block" title={album?.title}>
                    {album?.title}
                </h3>
                <p className="text-[10px] opacity-70 truncate block">{album?.artist}</p>
            </div>
        </div>
    );
};

export default CommunityAlbumCard;
