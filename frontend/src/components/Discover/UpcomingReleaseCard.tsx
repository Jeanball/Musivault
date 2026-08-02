import React from 'react';
import { useTranslation } from 'react-i18next';
import type { UpcomingRelease } from '../../types/discover.types';
import { formatReleaseDate } from '../../utils/date';

interface UpcomingReleaseCardProps {
    release: UpcomingRelease;
}

/** Styles shown as chips; the rest collapse into a "+N" badge. */
const VISIBLE_STYLES = 2;

/**
 * Covers fade in on `onLoad`, but an image served straight from the browser
 * cache can already be complete by the time React attaches the handler — the
 * event never fires and the tile stays blank. Reveal those immediately.
 */
const revealIfCached = (img: HTMLImageElement | null): void => {
    if (img?.complete && img.naturalWidth > 0) {
        img.classList.remove('opacity-0');
    }
};

const UpcomingReleaseCard: React.FC<UpcomingReleaseCardProps> = ({ release }) => {
    const { t, i18n } = useTranslation();
    const shownStyles = release.matchedStyles.slice(0, VISIBLE_STYLES);
    const hiddenStyles = release.matchedStyles.slice(VISIBLE_STYLES);

    return (
        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
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
                    src={release.coverArtUrl || '/placeholder-album.svg'}
                    alt={release.title}
                    loading="lazy"
                    decoding="async"
                    className="object-cover w-full h-full relative z-[1] opacity-0 transition-opacity duration-300"
                    onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/placeholder-album.svg';
                    }}
                />
                {/* Readability scrim behind the date/type overlay. */}
                {/* Kept to single-digit z-indexes: the overlay only has to beat the
                    cover image, and anything higher paints over page-level dropdowns. */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-[2]" />
                <span className="absolute bottom-1 left-1.5 z-[3] text-[10px] font-medium text-white drop-shadow">
                    {formatReleaseDate(release.firstReleaseDate, release.datePrecision, i18n.language)}
                </span>
                {release.primaryType === 'EP' && (
                    <span className="absolute bottom-1 right-1.5 z-[3] badge badge-xs">EP</span>
                )}
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
