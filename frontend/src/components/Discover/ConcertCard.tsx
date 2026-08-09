import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ticket, MapPin, Clock, Disc3, Users } from 'lucide-react';
import type { Concert } from '../../types/discover.types';
import { formatDistance } from '../../utils/formatters';
import { parseLocalDate, formatShortDate } from '../../utils/date';
import ConcertModal from './ConcertModal';

interface ConcertCardProps {
    concert: Concert;
}

/** Ticketmaster's placeholders for "we haven't classified this", not worth a badge. */
const EMPTY_CLASSIFICATIONS = new Set(['Undefined', 'Other', '']);

const formatPrice = (concert: Concert, locale: string): string | null => {
    if (concert.priceMin == null || !concert.priceCurrency) return null;
    const format = (value: number) =>
        new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: concert.priceCurrency,
            maximumFractionDigits: 0,
        }).format(value);
    // A single figure when the range collapses — "40 – 40 $" reads as a bug.
    return concert.priceMax && concert.priceMax !== concert.priceMin
        ? `${format(concert.priceMin)} – ${format(concert.priceMax)}`
        : format(concert.priceMin);
};

const ConcertCard: React.FC<ConcertCardProps> = ({ concert }) => {
    const { t, i18n } = useTranslation();
    const [detailsOpen, setDetailsOpen] = useState(false);

    const date = formatShortDate(parseLocalDate(concert.startLocalDate), i18n.language);
    // Ticketmaster gives seconds we have no use for, and flags the many events
    // whose time is not announced yet.
    const time = !concert.timeTBA && concert.startLocalTime
        ? concert.startLocalTime.slice(0, 5)
        : null;
    const price = formatPrice(concert, i18n.language);
    const location = [concert.venueName, concert.venueCity].filter(Boolean).join(', ');

    // The event's own classification, never the user's styles: those only
    // explain why it surfaced, and printing them on the card claimed things
    // about the act that were plainly false ("Patrick Bruel — Hardcore").
    const genres = [concert.genre, concert.subGenre]
        .filter((name): name is string => Boolean(name))
        .filter((name) => !EMPTY_CLASSIFICATIONS.has(name))
        .filter((name, index, all) => all.indexOf(name) === index);

    // A single act whose name is already the card's title tells the reader
    // nothing they can't see — only a real bill is worth the overlay.
    const showLineup = concert.attractions.length > 1
        || (concert.attractions.length === 1 && concert.attractions[0] !== concert.name);
    const ownedActs = new Set(concert.matchedArtists);

    // Kept on the tooltip, where it reads as a reason rather than a label.
    const matchReason = concert.matchType === 'artist'
        ? concert.matchedArtists.join(', ')
        : concert.matchedStyles.length
            ? t('discover.matchesYourStyles', { styles: concert.matchedStyles.join(', ') })
            : undefined;

    return (
        <>
            <div
                role="button"
                tabIndex={0}
                onClick={() => setDetailsOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setDetailsOpen(true);
                    }
                }}
                className="group card bg-base-200 shadow-xs hover:shadow-md transition-shadow duration-300 h-full overflow-hidden cursor-pointer text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
                <div className="relative h-40 shrink-0">
                    {concert.imageUrl ? (
                        <img
                            src={concert.imageUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-base-300 flex items-center justify-center">
                            <Ticket size={40} className="opacity-40" />
                        </div>
                    )}

                    {/* The whole bill on hover: Ticketmaster lists support acts as
                        attractions, and a card only has room for the event's own
                        name — which on a festival or a double bill names one act
                        out of six. Touch devices never hover, so the same list is
                        repeated in the modal. */}
                    {showLineup && (
                        <div className="absolute inset-0 bg-base-100/95 p-3 overflow-y-auto opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-visible:opacity-100">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-1 flex items-center gap-1.5">
                                <Users size={13} />
                                {t('discover.lineup')}
                            </h4>
                            <ul className="text-sm space-y-0.5">
                                {concert.attractions.map((act) => (
                                    <li key={act} className="flex items-center gap-1.5 wrap-break-word">
                                        <span className="min-w-0">{act}</span>
                                        {ownedActs.has(act) && (
                                            <Disc3 size={12} className="shrink-0 text-primary" />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="card-body p-4 gap-2">
                    <div className="flex items-start justify-between gap-2">
                        {/* min-w-0 on both flex levels: without it the name refuses to
                            shrink below its natural width and overflows the card. */}
                        <h3 className="card-title text-base leading-tight items-start min-w-0 flex-1" title={concert.name}>
                            <span className="min-w-0 line-clamp-2 wrap-break-word">{concert.name}</span>
                        </h3>
                        <span className="badge badge-ghost badge-sm whitespace-nowrap shrink-0">
                            {t('discover.kmAway', { distance: formatDistance(concert.distanceKm, i18n.language) })}
                        </span>
                    </div>

                    <p className="text-sm font-medium flex items-center gap-1.5">
                        <Clock size={14} className="shrink-0 opacity-60" />
                        <span>{concert.dateTBA ? t('discover.dateToBeAnnounced') : date}</span>
                        {time && <span className="text-base-content/60 font-normal">{time}</span>}
                    </p>

                    {location && (
                        <p className="text-sm text-base-content/70 flex items-start gap-1.5">
                            <MapPin size={14} className="shrink-0 mt-0.5 opacity-60" />
                            <span className="min-w-0 wrap-break-word">{location}</span>
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1" title={matchReason}>
                        {concert.matchType === 'artist' && (
                            <span className="badge badge-primary badge-sm gap-1">
                                <Disc3 size={12} />
                                {t('discover.inYourCollection')}
                            </span>
                        )}
                        {genres.map((name) => (
                            <span key={name} className="badge badge-ghost badge-sm">{name}</span>
                        ))}
                    </div>

                    {/* Hover is not available on touch, so the bill is also stated
                        plainly — and it doubles as the hint that there is more
                        behind the card. */}
                    {concert.attractions.length > 1 && (
                        <p className="text-xs text-base-content/60 flex items-center gap-1.5">
                            <Users size={13} className="shrink-0 opacity-60" />
                            {t('discover.actsOnBill', { count: concert.attractions.length })}
                        </p>
                    )}

                    <div className="card-actions mt-auto pt-2 items-center justify-between gap-2">
                        <a
                            href={concert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="btn btn-primary btn-sm gap-1.5"
                        >
                            <Ticket size={14} />
                            {t('discover.tickets')}
                        </a>
                        {price && <span className="text-sm text-base-content/60">{price}</span>}
                    </div>
                </div>
            </div>

            {detailsOpen && <ConcertModal concert={concert} onClose={() => setDetailsOpen(false)} />}
        </>
    );
};

export default ConcertCard;
