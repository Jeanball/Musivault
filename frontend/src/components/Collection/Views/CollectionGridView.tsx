import React from 'react';
import type { CollectionItem } from '../../../types/collection.types';
import { getItemValue } from '../../../utils/itemValue';
import { getImageUrl } from '../../../utils/imageUrl';
import { hasActiveFormatVerificationIssue } from '../../../utils/formatVerification';
import FormatVerificationBadge from '../../Common/FormatVerificationBadge';
import FormatColorBadge from '../../Common/FormatColorBadge';
import CoverOverlay from '../../Common/CoverOverlay';
import { useCurrency } from '../../../hooks/useCurrency';

/** Shared by the real variant badge and its invisible placeholder, so the space
    one reserves is exactly the space the other fills. */
const VARIANT_BADGE_CLASS = 'text-[10px] py-1 min-h-4 max-w-full';

interface CollectionGridViewProps {
    /** Already ordered by artist then title: the artist lives on the card, so a
        band of covers reads as one artist without a header cutting the row. */
    items: CollectionItem[];
    onItemClick: (item: CollectionItem) => void;
}

const CollectionGridView: React.FC<CollectionGridViewProps> = ({
    items,
    onItemClick
}) => {
    const { formatValue } = useCurrency();
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item) => (
                <div
                    key={item._id}
                    onClick={() => onItemClick(item)}
                    className="card bg-base-200 shadow-card transition-transform hover:scale-105 cursor-pointer"
                >
                    <figure className="aspect-square w-full bg-base-300 relative">
                        {hasActiveFormatVerificationIssue(item.formatVerification) && (
                            <div className="absolute top-2 right-2 z-3 rounded-full bg-base-100/90 p-1 shadow-panel">
                                <FormatVerificationBadge verification={item.formatVerification} className="tooltip-left" />
                            </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center text-base-content/20">
                            {/* Simple music icon as a placeholder */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <img
                            src={getImageUrl(item.album.cover_image || item.album.thumb)}
                            alt={item.album.title}
                            loading="lazy"
                            className="w-full h-full object-cover relative z-1 opacity-0 transition-opacity duration-300"
                            onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                        />
                        {/* On the sleeve rather than under it: the format is what you
                            scan a shelf for, and it costs the cover no room. No date
                            here, unlike the discover tiles: in your own collection
                            every record is one you added. */}
                        <CoverOverlay type={item.format.name} typeTitle={item.format.name} />
                    </figure>
                    <div className="card-body p-3 gap-0">
                        {/* The artist leads, the way the section header used to. */}
                        <h2
                            className="text-base font-bold leading-tight truncate"
                            title={item.album.artist}
                        >
                            {item.album.artist}
                        </h2>
                        <p
                            className="text-xs text-base-content/70 leading-tight truncate"
                            title={item.album.title}
                        >
                            {item.album.title}
                        </p>
                        {/* Tags sit above the price and their row is always
                            rendered: a variant appearing used to push the price
                            up a line, so prices sat at different heights across
                            the grid. An invisible twin of the badge reserves the
                            room, which keeps the two in step if its style ever
                            changes. One line only: wrapping would bring the
                            drift right back. */}
                        <div className="mt-1.5 flex gap-1 overflow-hidden">
                            {item.format.text && item.format.text !== item.format.name ? (
                                <FormatColorBadge
                                    text={item.format.text}
                                    maxChars={20}
                                    className={VARIANT_BADGE_CLASS}
                                    title={item.format.text}
                                />
                            ) : (
                                <FormatColorBadge text={' '} className={`${VARIANT_BADGE_CLASS} invisible`} />
                            )}
                        </div>
                        {/* Outlined rather than filled: two solid badges per
                            tile turned a wall of covers into a wall of
                            badges, and neither colour meant anything. */}
                        <div className="card-actions justify-start mt-auto pt-2 gap-1">
                            {(() => {
                                const val = getItemValue(item);
                                return val > 0 ? (
                                    <div className="badge badge-outline badge-sm font-semibold">
                                        {formatValue(val)}
                                    </div>
                                ) : (
                                    <div className="badge badge-outline badge-sm text-base-content/40">
                                        —
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default CollectionGridView;
