import React from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../utils/imageUrl';
import { revealIfCached } from '../../utils/imageReveal';
import CoverOverlay from '../Common/CoverOverlay';
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
    const { t, i18n } = useTranslation();
    const album = item.album;
    const addedDate = item.addedAt ? new Date(item.addedAt) : null;

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
            className="card bg-base-100 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 cursor-pointer"
        >
            <figure className="aspect-square relative overflow-hidden bg-base-300">
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
                {/* Only the date and the format sit on the sleeve; the collector
                    reads better as a line under the record it belongs to. */}
                <CoverOverlay
                    date={addedDate?.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}
                    dateTitle={addedDate ? `${t('collection.added')}: ${addedDate.toLocaleDateString(i18n.language)}` : undefined}
                    type={item.format.name}
                    typeTitle={item.format.name}
                />
            </figure>
            <div className="card-body p-2 gap-0.5">
                <h3 className="card-title text-xs leading-tight truncate block" title={album?.title}>
                    {album?.title}
                </h3>
                <p className="text-[10px] opacity-70 truncate block">{album?.artist}</p>
                <Link
                    to={`/shared/${item.user.publicShareId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 flex items-center gap-1.5 text-sm font-semibold hover:underline"
                >
                    <span className="size-4 shrink-0 rounded-full bg-base-300 text-[9px] font-bold grid place-items-center">
                        {item.user.username.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{item.user.username}</span>
                </Link>
            </div>
        </div>
    );
};

export default CommunityAlbumCard;
