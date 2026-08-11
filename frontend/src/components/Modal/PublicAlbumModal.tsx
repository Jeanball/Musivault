import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionItem } from '../../types/collection.types';
import { getItemValue } from '../../utils/itemValue';
import { getImageUrl } from '../../utils/imageUrl';
import { stripDiscogsSuffix } from '../../utils/formatters';
import FormatColorBadge from '../Common/FormatColorBadge';
import { SpotifyIcon, DiscogsIcon } from '../Common/BrandIcons';
import FieldRow from '../Common/FieldRow';
import LabelLink from '../Common/LabelLink';
import { useCurrency } from '../../hooks/useCurrency';
import { MEDIA_CONDITIONS, SLEEVE_CONDITIONS } from '../../utils/conditions';

interface PublicAlbumModalProps {
    item: CollectionItem | null;
    onClose: () => void;
}

/** Tracks shown before the "show all" toggle kicks in, keeping the modal a fixed size. */
const COLLAPSED_TRACK_COUNT = 8;

const PublicAlbumModal: React.FC<PublicAlbumModalProps> = ({ item, onClose }) => {
    const { t } = useTranslation();
    const { formatValue } = useCurrency();
    const [tracksExpanded, setTracksExpanded] = React.useState(false);

    React.useEffect(() => setTracksExpanded(false), [item?._id]);

    if (!item) return null;

    const album = item.album;
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(`${album.artist} ${album.title}`)}`;
    const discogsUrl = album.discogsId ? `https://www.discogs.com/release/${album.discogsId}` : null;
    const labels = album.labels || [];
    const styles = album.styles || [];
    const value = getItemValue(item);
    const tracklist = album.tracklist || [];
    const hiddenTrackCount = Math.max(0, tracklist.length - COLLAPSED_TRACK_COUNT);
    const visibleTracks = tracksExpanded ? tracklist : tracklist.slice(0, COLLAPSED_TRACK_COUNT);

    const mediaLabel = item.mediaCondition
        ? MEDIA_CONDITIONS.find(c => c.value === item.mediaCondition)
        : null;
    const sleeveLabel = item.sleeveCondition
        ? SLEEVE_CONDITIONS.find(c => c.value === item.sleeveCondition)
        : null;

    return (
        <dialog className="modal modal-middle px-2 sm:px-4" open={!!item}>
            <div className="modal-box max-w-lg md:max-w-4xl w-full p-0 overflow-hidden h-[85vh] md:h-144 flex flex-col">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10 bg-base-300/60 hover:bg-base-300"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>

                <div className="flex-1 overflow-y-auto">
                {/* Cover + Title Header */}
                <div className="flex flex-col sm:flex-row gap-4 p-5 pb-0">
                    <img
                        src={getImageUrl(album.cover_image || '/placeholder-album.svg')}
                        alt={album.title}
                        className="w-full sm:w-36 sm:h-36 md:w-44 md:h-44 aspect-square object-cover border border-base-300 mx-auto sm:mx-0 max-w-[200px]"
                    />
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">{item.format.name}</span>
                        <h2 className="text-xl font-bold leading-tight line-clamp-2 mt-1">{album.title}</h2>
                        <p className="text-base text-base-content/70 mt-0.5">{stripDiscogsSuffix(album.artist)}</p>

                        {(item.format.text || (item.format.descriptions && item.format.descriptions.length > 0)) && (
                            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3">
                                {item.format.text && (
                                    <FormatColorBadge text={item.format.text} className="badge-sm min-h-4 py-0.5" />
                                )}
                                {item.format.descriptions?.map((desc, i) => (
                                    <FormatColorBadge key={i} text={desc} className="badge-sm min-h-4 py-0.5" />
                                ))}
                            </div>
                        )}

                        {/* External Links */}
                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                            <a
                                href={spotifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn flex-1 h-12 min-h-12 text-base sm:btn-sm sm:h-8 sm:min-h-8 sm:text-sm btn-spotify"
                            >
                                <SpotifyIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                                {t('album.listenOnSpotify')}
                            </a>
                            {discogsUrl && (
                                <a
                                    href={discogsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn flex-1 h-12 min-h-12 text-base sm:btn-sm sm:h-8 sm:min-h-8 sm:text-sm btn-discogs"
                                >
                                    <DiscogsIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                                    {t('album.viewOnDiscogs')}
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content body */}
                <div className="px-5 pt-4 pb-5 md:grid md:grid-cols-2 md:gap-x-6 md:items-start">

                    <div className="mb-4 md:mb-0">
                        {labels.length > 0 && (
                            <FieldRow label={t('album.label')}>
                                <LabelLink label={labels[0]} />
                                {labels[0].catno && labels[0].catno !== 'none' && (
                                    <span className="text-base-content/50"> · {labels[0].catno}</span>
                                )}
                            </FieldRow>
                        )}
                        {album.year && (
                            <FieldRow label={t('common.year')}>{album.year}</FieldRow>
                        )}
                        {styles.length > 0 && (
                            <FieldRow label={t('album.genres')}>{styles.join(' · ')}</FieldRow>
                        )}
                        {item.mediaCondition && mediaLabel && (
                            <FieldRow label={t('condition.media')}>{t(mediaLabel.labelKey)}</FieldRow>
                        )}
                        {item.sleeveCondition && sleeveLabel && (
                            <FieldRow label={t('condition.sleeve')}>{t(sleeveLabel.labelKey)}</FieldRow>
                        )}
                        {item.addedAt && (
                            <FieldRow label={t('collection.added')}>{new Date(item.addedAt).toLocaleDateString()}</FieldRow>
                        )}
                        {value > 0 && (
                            <FieldRow label={t('stats.value')}>
                                <span className="font-mono text-lg font-bold tabular-nums">
                                    {formatValue(value)}
                                </span>
                            </FieldRow>
                        )}
                    </div>

                    {/* Tracklist */}
                    {album.tracklist && album.tracklist.length > 0 && (
                        <div className="mb-4 md:mb-0">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-1">
                                {t('album.tracklist')}{' '}
                                <span className="normal-case font-normal">({album.tracklist.length})</span>
                            </h3>
                            <div className="border-t border-base-300">
                                {visibleTracks.map((track, i) => (
                                    <div key={i} className="flex items-baseline gap-2 py-1 border-b border-base-300 text-sm">
                                        <span className="font-mono text-xs text-base-content/50 w-6 shrink-0">{track.position}</span>
                                        <span className="flex-1 min-w-0 truncate" title={track.title}>{track.title}</span>
                                        <span className="font-mono tabular-nums text-xs text-base-content/50 shrink-0">{track.duration || '—'}</span>
                                    </div>
                                ))}
                            </div>
                            {hiddenTrackCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setTracksExpanded(!tracksExpanded)}
                                    className="btn btn-ghost btn-sm w-full gap-1 text-xs text-base-content/70"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                        className={tracksExpanded ? 'rotate-180 transition-transform' : 'transition-transform'}
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                    {tracksExpanded
                                        ? t('album.showFewerTracks')
                                        : t('album.showAllTracks', { n: hiddenTrackCount })}
                                </button>
                            )}
                        </div>
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

export default PublicAlbumModal;
