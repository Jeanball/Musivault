import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Ticket, MapPin, Clock, Calendar, Navigation, Disc3, Users, Info,
    CreditCard, Accessibility, Car, Map, ExternalLink, X, AlertTriangle,
} from 'lucide-react';
import type { Concert, ConcertAct, ConcertDetails } from '../../types/discover.types';
import { getConcertDetails } from '../../api/discover';
import { formatDistance } from '../../utils/formatters';
import { parseLocalDate } from '../../utils/date';

interface ConcertModalProps {
    /** The list entry the card was rendered from, so the modal opens filled in. */
    concert: Concert;
    onClose: () => void;
}

/** Ticketmaster's placeholders for "we haven't classified this", not worth a badge. */
const EMPTY_CLASSIFICATIONS = new Set(['Undefined', 'Other', '']);

/** Streaming and reference links Ticketmaster carries per act, in display order. */
const ACT_LINKS: Array<{ key: keyof ConcertAct['links']; label: string }> = [
    { key: 'spotify', label: 'Spotify' },
    { key: 'itunes', label: 'iTunes' },
    { key: 'youtube', label: 'YouTube' },
    { key: 'lastfm', label: 'Last.fm' },
    { key: 'musicbrainz', label: 'MusicBrainz' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'wiki', label: 'Wikipedia' },
    { key: 'homepage', label: 'Web' },
];

const formatLongDate = (date: string, locale: string): string =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        .format(parseLocalDate(date));

/** Sale windows come as UTC instants, unlike the venue-local event dates. */
const formatInstant = (iso: string, locale: string): string =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

const formatMoney = (value: number, currency: string, locale: string): string =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

/** A labelled block of Ticketmaster prose, rendered only when there is prose. */
const InfoBlock: React.FC<{ label: string; children?: string }> = ({ label, children }) => {
    if (!children?.trim()) return null;
    return (
        <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">{label}</h4>
            <p className="text-sm whitespace-pre-line break-words">{children}</p>
        </div>
    );
};

const ActRow: React.FC<{ act: ConcertAct }> = ({ act }) => {
    const { t } = useTranslation();

    const genres = [act.genre, act.subGenre]
        .filter((name): name is string => Boolean(name))
        .filter((name) => !EMPTY_CLASSIFICATIONS.has(name))
        .filter((name, index, all) => all.indexOf(name) === index);

    const links = ACT_LINKS.filter(({ key }) => act.links[key]);

    return (
        <li className="flex items-start gap-3 py-2 border-b border-base-300 last:border-b-0">
            {act.imageUrl ? (
                <img src={act.imageUrl} alt="" loading="lazy" className="w-12 h-12 rounded object-cover shrink-0" />
            ) : (
                <div className="w-12 h-12 rounded bg-base-300 flex items-center justify-center shrink-0">
                    <Users size={18} className="opacity-40" />
                </div>
            )}

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium break-words">{act.name}</span>
                    {act.owned && (
                        <span className="badge badge-primary badge-sm gap-1">
                            <Disc3 size={11} />
                            {t('discover.inYourCollection')}
                        </span>
                    )}
                </div>
                {genres.length > 0 && (
                    <p className="text-xs text-base-content/60">{genres.join(' · ')}</p>
                )}

                {/* Under the name and wrapping, never in a rigid row beside it:
                    Ticketmaster carries up to nine links for a well-known act,
                    which on a phone runs well past the edge of the sheet. */}
                {links.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                        {links.map(({ key, label }) => (
                            <a
                                key={key}
                                href={act.links[key]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-xs"
                                title={label}
                            >
                                {label}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </li>
    );
};

/**
 * The long form of a concert. Opens on whatever the list already knew, then
 * fills in the rest from a single Ticketmaster call — the bill with per-act
 * links, sale windows, prices, and the venue's practical information.
 */
const ConcertModal: React.FC<ConcertModalProps> = ({ concert, onClose }) => {
    const { t, i18n } = useTranslation();
    const [details, setDetails] = useState<ConcertDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        getConcertDetails(concert.tmId)
            .then((data) => { if (!cancelled) setDetails(data); })
            .catch((err) => {
                if (cancelled) return;
                setError(err?.response?.status === 404
                    ? t('discover.concertNoLongerListed')
                    : t('discover.failedLoadConcertDetails'));
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [concert.tmId, t]);

    // Escape closes it like any other dialog; <dialog open> does not do this on
    // its own, only dialogs opened through showModal().
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const locale = i18n.language;
    const time = !concert.timeTBA && concert.startLocalTime ? concert.startLocalTime.slice(0, 5) : null;
    const doors = details?.doorsLocalTime?.slice(0, 5);
    const venue = details?.venue;

    // The list already carries the names; the fetched bill only adds detail to
    // them, so the section can render before the request lands.
    const lineup: ConcertAct[] = details?.lineup.length
        ? details.lineup
        : concert.attractions.map((name) => ({
            tmId: name,
            name,
            links: {},
            owned: concert.matchedArtists.includes(name),
        }));

    const address = [
        venue?.address,
        [venue?.postalCode, venue?.city].filter(Boolean).join(' '),
        venue?.country,
    ].filter(Boolean).join(', ');

    const venueNotes = [
        { label: t('discover.boxOffice'), value: venue?.boxOfficeInfo, icon: Info },
        { label: t('discover.openHours'), value: venue?.openHours, icon: Clock },
        { label: t('discover.acceptedPayment'), value: venue?.acceptedPayment, icon: CreditCard },
        { label: t('discover.willCall'), value: venue?.willCall, icon: Ticket },
        { label: t('discover.parking'), value: venue?.parkingDetail, icon: Car },
        { label: t('discover.accessibleSeating'), value: venue?.accessibleSeatingDetail, icon: Accessibility },
    ].filter((note): note is typeof note & { value: string } => Boolean(note.value?.trim()));

    const hasGoodToKnow = Boolean(
        details && (details.info || details.pleaseNote || details.ticketLimit || details.accessibility || details.ageRestricted)
    );

    return (
        <dialog className="modal modal-middle px-2 sm:px-4" open>
            {/* overflow-x-hidden rather than overflow-hidden: same computed
                result, but it states the rule the content has to obey — the
                sheet scrolls vertically and only vertically. */}
            <div className="modal-box max-w-2xl w-full p-0 overflow-x-hidden max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10 bg-base-300/60 hover:bg-base-300"
                    aria-label={t('common.close')}
                >
                    <X size={16} />
                </button>

                {concert.imageUrl && (
                    <figure className="h-44 sm:h-56">
                        <img src={concert.imageUrl} alt="" className="w-full h-full object-cover" />
                    </figure>
                )}

                {/* Ticketmaster prose carries raw URLs and venue names with no
                    space in them; breaking them is what keeps the sheet from
                    growing wider than the screen. */}
                <div className="p-5 space-y-5 break-words">
                    <div>
                        <h2 className="text-xl font-bold leading-tight break-words">{concert.name}</h2>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="badge badge-ghost badge-sm">
                                {t('discover.kmAway', { distance: formatDistance(concert.distanceKm, locale) })}
                            </span>
                            {concert.status === 'rescheduled' && (
                                <span className="badge badge-warning badge-sm">{t('discover.statusRescheduled')}</span>
                            )}
                            {concert.status === 'postponed' && (
                                <span className="badge badge-warning badge-sm">{t('discover.statusPostponed')}</span>
                            )}
                            {concert.status === 'offsale' && (
                                <span className="badge badge-ghost badge-sm">{t('discover.statusOffsale')}</span>
                            )}
                        </div>
                    </div>

                    {/* When + where */}
                    <div className="space-y-1.5">
                        <p className="flex items-start gap-2 text-sm font-medium">
                            <Calendar size={16} className="shrink-0 mt-0.5 opacity-60" />
                            <span className="min-w-0">
                                {concert.dateTBA
                                    ? t('discover.dateToBeAnnounced')
                                    : formatLongDate(concert.startLocalDate, locale)}
                                {time && <span className="text-base-content/60 font-normal"> · {time}</span>}
                                {doors && (
                                    <span className="text-base-content/60 font-normal">
                                        {' '}· {t('discover.doorsOpen', { time: doors })}
                                    </span>
                                )}
                            </span>
                        </p>

                        <p className="flex items-start gap-2 text-sm">
                            <MapPin size={16} className="shrink-0 mt-0.5 opacity-60" />
                            <span className="min-w-0 break-words">
                                <span className="font-medium">{venue?.name || concert.venueName}</span>
                                {address && <span className="block text-base-content/70">{address}</span>}
                            </span>
                        </p>

                        {details?.promoters.length ? (
                            <p className="text-xs text-base-content/60">
                                {t('discover.promotedBy', { names: details.promoters.join(', ') })}
                            </p>
                        ) : null}
                    </div>

                    {error && (
                        <div className="alert alert-warning py-2 text-sm">
                            <AlertTriangle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Line-up */}
                    {lineup.length > 0 && (
                        <section>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-1">
                                {t('discover.lineup')} <span className="normal-case font-normal">({lineup.length})</span>
                            </h3>
                            <ul className="border-t border-base-300">
                                {lineup.map((act) => <ActRow key={act.tmId} act={act} />)}
                            </ul>
                            {loading && (
                                <p className="text-xs text-base-content/50 mt-1">{t('discover.loadingDetails')}</p>
                            )}
                        </section>
                    )}

                    {/* Tickets */}
                    {details && (details.priceRanges.length > 0 || details.onSaleStart || details.presales.length > 0) && (
                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                {t('discover.ticketsAndPrices')}
                            </h3>

                            {details.priceRanges.map((price, index) => (
                                price.min != null && price.currency ? (
                                    <p key={index} className="text-sm flex items-center gap-2">
                                        <Ticket size={14} className="shrink-0 opacity-60" />
                                        <span className="min-w-0">
                                            {price.max != null && price.max !== price.min
                                                ? `${formatMoney(price.min, price.currency, locale)} – ${formatMoney(price.max, price.currency, locale)}`
                                                : formatMoney(price.min, price.currency, locale)}
                                            {price.type && <span className="text-base-content/60"> · {price.type}</span>}
                                        </span>
                                    </p>
                                ) : null
                            ))}

                            {details.onSaleStart && (
                                <p className="text-sm text-base-content/70">
                                    {t('discover.onSaleFrom', { date: formatInstant(details.onSaleStart, locale) })}
                                    {details.onSaleEnd && ` · ${t('discover.onSaleUntil', { date: formatInstant(details.onSaleEnd, locale) })}`}
                                </p>
                            )}

                            {details.presales.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mt-2">
                                        {t('discover.presales')}
                                    </h4>
                                    <ul className="text-sm space-y-0.5 mt-1">
                                        {details.presales.map((presale, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <span className="min-w-0 break-words">
                                                    {presale.url ? (
                                                        <a href={presale.url} target="_blank" rel="noopener noreferrer" className="link link-hover">
                                                            {presale.name || t('discover.presales')}
                                                        </a>
                                                    ) : (
                                                        presale.name || t('discover.presales')
                                                    )}
                                                    {presale.startDateTime && (
                                                        <span className="text-base-content/60">
                                                            {' '}· {formatInstant(presale.startDateTime, locale)}
                                                        </span>
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Good to know */}
                    {hasGoodToKnow && details && (
                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                {t('discover.goodToKnow')}
                            </h3>
                            {details.ageRestricted && (
                                <p className="text-sm flex items-center gap-2">
                                    <AlertTriangle size={14} className="shrink-0 opacity-60" />
                                    {t('discover.ageRestricted')}
                                </p>
                            )}
                            <InfoBlock label={t('discover.eventInfo')}>{details.info}</InfoBlock>
                            <InfoBlock label={t('discover.pleaseNote')}>{details.pleaseNote}</InfoBlock>
                            <InfoBlock label={t('discover.ticketLimitLabel')}>{details.ticketLimit}</InfoBlock>
                            <InfoBlock label={t('discover.accessibilityLabel')}>{details.accessibility}</InfoBlock>
                        </section>
                    )}

                    {/* Venue practicalities */}
                    {(venueNotes.length > 0 || venue?.generalRule || venue?.childRule) && (
                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                {t('discover.venueInfo')}
                            </h3>
                            {venueNotes.map(({ label, value, icon: Icon }) => (
                                <p key={label} className="text-sm flex items-start gap-2">
                                    <Icon size={14} className="shrink-0 mt-0.5 opacity-60" />
                                    <span className="min-w-0 break-words">
                                        <span className="text-base-content/60">{label}: </span>
                                        {value}
                                    </span>
                                </p>
                            ))}
                            <InfoBlock label={t('discover.houseRules')}>{venue?.generalRule}</InfoBlock>
                            <InfoBlock label={t('discover.childRule')}>{venue?.childRule}</InfoBlock>
                        </section>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        <a
                            href={concert.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm gap-1.5 flex-1"
                        >
                            <Ticket size={14} />
                            {t('discover.tickets')}
                        </a>
                        <a
                            href={`https://www.openstreetmap.org/directions?to=${venue?.lat ?? concert.lat},${venue?.lon ?? concert.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm gap-1.5"
                        >
                            <Navigation size={14} />
                            {t('discover.directions')}
                        </a>
                        {details?.seatmapUrl && (
                            <a
                                href={details.seatmapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm gap-1.5"
                            >
                                <Map size={14} />
                                {t('discover.seatmap')}
                            </a>
                        )}
                        {venue?.url && (
                            <a
                                href={venue.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm gap-1.5"
                            >
                                <ExternalLink size={14} />
                                {t('discover.venuePage')}
                            </a>
                        )}
                    </div>
                </div>
            </div>

            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    );
};

export default ConcertModal;
