import React from 'react';
import { useTranslation } from 'react-i18next';
import type { UpcomingRelease } from '../../types/discover.types';
import { formatReleaseDate } from '../../utils/date';
import { revealIfCached } from '../../utils/imageReveal';
import CoverOverlay from '../Common/CoverOverlay';

interface UpcomingReleaseCardProps {
    release: UpcomingRelease;
    /** Opens the release's modal; the tile is inert without it. */
    onSelect?: (release: UpcomingRelease) => void;
    /**
     * Set on the cards that are on screen the moment the page paints. Lazy
     * loading holds the request back until layout settles, which on a tile the
     * user is already looking at is pure delay.
     */
    eager?: boolean;
}

/** Styles shown as chips; the rest collapse into a "+N" badge. */
const VISIBLE_STYLES = 2;

const UpcomingReleaseCard: React.FC<UpcomingReleaseCardProps> = ({ release, onSelect, eager = false }) => {
    const { t, i18n } = useTranslation();
    const shownStyles = release.matchedStyles.slice(0, VISIBLE_STYLES);
    const hiddenStyles = release.matchedStyles.slice(VISIBLE_STYLES);

    return (
        <div
            {...(onSelect && {
                role: 'button',
                tabIndex: 0,
                onClick: () => onSelect(release),
                onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(release);
                    }
                }
            })}
            className={`card bg-base-100 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 group ${onSelect ? 'cursor-pointer' : ''}`}
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
                    src={release.coverArtUrl || '/placeholder-album.svg'}
                    alt={release.title}
                    loading={eager ? 'eager' : 'lazy'}
                    fetchPriority={eager ? 'high' : 'auto'}
                    decoding="async"
                    className="object-cover w-full h-full relative z-1 opacity-0 transition-opacity duration-300"
                    onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/placeholder-album.svg';
                    }}
                />
                <CoverOverlay
                    date={formatReleaseDate(release.firstReleaseDate, release.datePrecision, i18n.language)}
                    type={release.primaryType === 'EP' ? 'EP' : null}
                />
            </figure>
            <div className="card-body p-2 gap-0.5">
                <h3 className="card-title text-xs leading-tight truncate block" title={release.title}>
                    {release.title}
                </h3>
                <p className="text-[10px] opacity-70 truncate block">{release.artist}</p>
                {shownStyles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                        {shownStyles.map((style) => (
                            <span key={style} className="badge badge-ghost badge-xs">{style}</span>
                        ))}
                        {hiddenStyles.length > 0 && (
                            <span
                                className="badge badge-ghost badge-xs"
                                title={hiddenStyles.join(', ')}
                            >
                                {t('discover.moreStyles', { n: hiddenStyles.length })}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpcomingReleaseCard;
