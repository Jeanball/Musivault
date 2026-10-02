import React from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import CoverOverlay from '../Common/CoverOverlay';
import { ChevronDown } from 'lucide-react';
import { getImageUrl } from '../../utils/imageUrl';
import { revealIfCached } from '../../utils/imageReveal';
import type { CollectionItem } from '../../types/collection.types';
import type { PublicUser } from '../../types/public.types';

interface PublicUserCardProps {
    user: PublicUser;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onSelectAlbum: (item: CollectionItem) => void;
}

const PublicUserCard: React.FC<PublicUserCardProps> = ({ user, isExpanded, onToggleExpand, onSelectAlbum }) => {
    const { t, i18n } = useTranslation();

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
        }
    };

    return (
        // Same shell as the shop and concert cards it sits beside: this was the
        // one panel on the page rolling its own surface.
        <div className="card bg-base-200 shadow-card">
          <div className="card-body p-4 gap-2">
            <div
                role="button"
                tabIndex={0}
                onClick={onToggleExpand}
                onKeyDown={handleKeyDown}
                aria-expanded={isExpanded}
                className="flex items-center justify-between gap-2 cursor-pointer"
            >
                <div className="flex items-center gap-4 min-w-0">
                    {/* Neutral rather than primary: the collector's name is the
                        subject here, and the accent belongs to the action. */}
                    <div className="avatar-placeholder avatar shrink-0">
                        <div className="bg-base-300 text-base-content rounded-full w-10 h-10">
                            <span className="text-lg font-bold">
                                {user.username.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-lg truncate">{user.username}</h3>
                        <p className="text-sm text-base-content/60">
                            {user.albumCount} {user.albumCount === 1 ? t('common.album') : t('common.albums')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        to={`/shared/${user.publicShareId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn btn-outline btn-sm"
                    >
                        {t('discover.viewCollection')}
                    </Link>
                    <ChevronDown
                        size={20}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>

            {isExpanded && (
                user.latestAlbums && user.latestAlbums.length > 0 ? (
                    <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-3 text-base-content/70">
                            {t('discover.latestUserAdditions', 'Latest additions')}
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                            {user.latestAlbums.map((item) => (
                                <div
                                    key={item._id}
                                    onClick={() => onSelectAlbum(item)}
                                    className="card bg-base-100 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
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
                                            src={getImageUrl(item.album?.cover_image || "/placeholder-album.svg")}
                                            alt={item.album?.title}
                                            loading="lazy"
                                            className="object-cover w-full h-full relative z-1 opacity-0 transition-opacity duration-300"
                                            onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                                        />
                                        {/* The format used to appear on hover only, so never on a
                                            phone. Same two corners as every other album tile now. */}
                                        <CoverOverlay
                                            date={new Date(item.addedAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}
                                            dateTitle={`${t('collection.added')}: ${new Date(item.addedAt).toLocaleDateString(i18n.language)}`}
                                            type={item.format?.name}
                                            typeTitle={item.format?.name}
                                        />
                                    </figure>
                                    <div className="card-body p-2 gap-0.5">
                                        <h3 className="card-title text-xs leading-tight truncate block" title={item.album?.title}>
                                            {item.album?.title}
                                        </h3>
                                        <p className="text-[10px] opacity-70 truncate block">{item.album?.artist}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-base-content/50 italic mt-4">
                        {t('discover.noLatestAlbums', 'No recent additions.')}
                    </p>
                )
            )}
          </div>
        </div>
    );
};

export default PublicUserCard;
