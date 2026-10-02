import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { X, CalendarClock, Disc3 } from 'lucide-react';
import type { UpcomingRelease } from '../../types/discover.types';
import { useCollectionContext } from '../../context/CollectionContext';
import { formatReleaseDate, parseLocalDate } from '../../utils/date';
import { stripDiscogsSuffix } from '../../utils/formatters';
import { getImageUrl } from '../../utils/imageUrl';
import { SpotifyIcon, DiscogsIcon } from '../Common/BrandIcons';

interface UpcomingReleaseModalProps {
    release: UpcomingRelease;
    onClose: () => void;
}

/** Records by the same artist listed before the count takes over. */
const MAX_OWNED_SHOWN = 4;

/**
 * The long form of a radar release. MusicBrainz gives us the release group and
 * nothing about the artist, so this doesn't pretend to be a biography: it shows
 * what the row already knew, what the user owns by the same name, and sends
 * them somewhere they can actually listen.
 */
const UpcomingReleaseModal: React.FC<UpcomingReleaseModalProps> = ({ release, onClose }) => {
    const { t, i18n } = useTranslation();
    const { collection } = useCollectionContext();

    // Escape closes it like any other dialog; <dialog open> does not do this on
    // its own, only dialogs opened through showModal().
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    // Matched on the name because that is all the two sources share: MusicBrainz
    // artist ids are not stored, and Discogs ids don't exist here at all. Good
    // enough to say "you already own this artist", never used to link anything.
    const ownedByArtist = useMemo(() => {
        const target = stripDiscogsSuffix(release.artist).toLowerCase().trim();
        if (!target) return [];
        return collection.filter(
            (item) => stripDiscogsSuffix(item.album.artist).toLowerCase().trim() === target
        );
    }, [collection, release.artist]);

    const artistQuery = encodeURIComponent(stripDiscogsSuffix(release.artist));

    const isFuture = parseLocalDate(release.firstReleaseDate).getTime() > Date.now();
    const formattedDate = formatReleaseDate(release.firstReleaseDate, release.datePrecision, i18n.language);

    const types = [release.primaryType, ...release.secondaryTypes];

    return (
        <dialog className="modal modal-middle px-2 sm:px-4" open>
            <div className="modal-box max-w-lg w-full p-0 overflow-x-hidden max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10 bg-base-300/60 hover:bg-base-300"
                    aria-label={t('common.close')}
                >
                    <X size={16} />
                </button>

                <div className="flex flex-col sm:flex-row gap-4 p-5">
                    <img
                        src={release.coverArtUrl || '/placeholder-album.svg'}
                        alt={release.title}
                        className="w-full sm:w-36 sm:h-36 aspect-square object-cover border border-base-300 mx-auto sm:mx-0 max-w-[200px]"
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/placeholder-album.svg';
                        }}
                    />
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                        <h2 className="text-xl font-bold leading-tight wrap-break-word">{release.title}</h2>
                        <p className="text-base text-base-content/70 mt-0.5 wrap-break-word">
                            {stripDiscogsSuffix(release.artist)}
                        </p>

                        <p className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-base-content/70 mt-2">
                            <CalendarClock size={14} className="shrink-0" />
                            {isFuture
                                ? t('discover.expectedOn', { date: formattedDate })
                                : t('discover.releasedOn', { date: formattedDate })}
                        </p>

                        <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-2">
                            {types.map((type) => (
                                <span key={type} className="badge badge-ghost badge-sm">{type}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-5 pb-5 space-y-5">
                    {/* Why this landed on the radar at all. */}
                    {release.matchedStyles.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-1.5">
                                {t('discover.whyThisRelease')}
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                                {release.matchedStyles.map((style) => (
                                    <span key={style} className="badge badge-outline badge-sm">{style}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* What the shelf already holds from this name: the fastest way to
                        remember whether an artist is worth following. */}
                    {ownedByArtist.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-1.5 flex items-center gap-1.5">
                                <Disc3 size={13} />
                                {t('discover.ownedByArtist', { count: ownedByArtist.length })}
                            </h3>
                            <ul className="divide-y divide-base-300 border-y border-base-300">
                                {ownedByArtist.slice(0, MAX_OWNED_SHOWN).map((item) => (
                                    <li key={item._id}>
                                        <Link
                                            to={`/app/album/${item._id}`}
                                            onClick={onClose}
                                            className="flex items-center gap-3 py-2 hover:bg-base-200 -mx-2 px-2"
                                        >
                                            <img
                                                src={getImageUrl(item.album.cover_image || '/placeholder-album.svg')}
                                                alt=""
                                                loading="lazy"
                                                className="w-10 h-10 object-cover border border-base-300 shrink-0"
                                            />
                                            <span className="min-w-0 flex-1 truncate text-sm" title={item.album.title}>
                                                {item.album.title}
                                            </span>
                                            {item.album.year && (
                                                <span className="text-xs text-base-content/50 shrink-0">{item.album.year}</span>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            {ownedByArtist.length > MAX_OWNED_SHOWN && (
                                <p className="text-xs text-base-content/60 mt-1.5">
                                    {t('discover.andMoreOwned', { count: ownedByArtist.length - MAX_OWNED_SHOWN })}
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-2">
                            {t('discover.discoverArtist')}
                        </h3>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <a
                                href={`https://open.spotify.com/search/${artistQuery}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn h-11 min-h-11 sm:btn-sm sm:h-9 sm:min-h-9 btn-spotify"
                            >
                                <SpotifyIcon />
                                {t('discover.artistOnSpotify')}
                            </a>
                            <a
                                href={`https://www.discogs.com/search/?q=${artistQuery}&type=artist`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn h-11 min-h-11 sm:btn-sm sm:h-9 sm:min-h-9 btn-discogs"
                            >
                                <DiscogsIcon />
                                {t('discover.artistOnDiscogs')}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    );
};

export default UpcomingReleaseModal;
