import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ticket, MapPin, Clock, Disc3 } from 'lucide-react';
import type { Concert } from '../../types/discover.types';
import { formatDistance } from '../../utils/formatters';
import { parseLocalDate, formatShortDate } from '../../utils/date';

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

    // Kept on the tooltip, where it reads as a reason rather than a label.
    const matchReason = concert.matchType === 'artist'
        ? concert.matchedArtists.join(', ')
        : concert.matchedStyles.length
            ? t('discover.matchesYourStyles', { styles: concert.matchedStyles.join(', ') })
            : undefined;

    return (
        <div className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow duration-300 h-full overflow-hidden">
            {concert.imageUrl ? (
                <figure className="h-40 shrink-0">
                    <img
                        src={concert.imageUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                    />
                </figure>
            ) : (
                <div className="h-40 shrink-0 bg-base-300 flex items-center justify-center">
                    <Ticket size={40} className="opacity-40" />
                </div>
            )}

            <div className="card-body p-4 gap-2">
                <div className="flex items-start justify-between gap-2">
                    {/* min-w-0 on both flex levels: without it the name refuses to
                        shrink below its natural width and overflows the card. */}
                    <h3 className="card-title text-base leading-tight items-start min-w-0 flex-1" title={concert.name}>
                        <span className="min-w-0 line-clamp-2 break-words">{concert.name}</span>
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
                        <span className="min-w-0 break-words">{location}</span>
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

                <div className="card-actions mt-auto pt-2 items-center justify-between gap-2">
                    <a
                        href={concert.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm gap-1.5"
                    >
                        <Ticket size={14} />
                        {t('discover.tickets')}
                    </a>
                    {price && <span className="text-sm text-base-content/60">{price}</span>}
                </div>
            </div>
        </div>
    );
};

export default ConcertCard;
