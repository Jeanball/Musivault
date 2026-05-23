import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionItem } from '../../types/collection.types';
import { getItemValue } from '../../types/collection.types';
import { getImageUrl } from '../../utils/imageUrl';
import { stripArtistSuffix } from '../../utils/formatters';
import { getFormatButtonStyle } from '../../utils/formatColors';
import { useCurrency } from '../../hooks/useCurrency';
import { MEDIA_CONDITIONS, SLEEVE_CONDITIONS } from './ConditionModal';

interface PublicAlbumModalProps {
    item: CollectionItem | null;
    onClose: () => void;
}

const PublicAlbumModal: React.FC<PublicAlbumModalProps> = ({ item, onClose }) => {
    const { t } = useTranslation();
    const { formatValue } = useCurrency();

    if (!item) return null;

    const album = item.album;
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(`${album.artist} ${album.title}`)}`;
    const discogsUrl = album.discogsId ? `https://www.discogs.com/release/${album.discogsId}` : null;
    const labels = album.labels || [];
    const styles = album.styles || [];
    const value = getItemValue(item);

    const mediaLabel = item.mediaCondition
        ? MEDIA_CONDITIONS.find(c => c.value === item.mediaCondition)
        : null;
    const sleeveLabel = item.sleeveCondition
        ? SLEEVE_CONDITIONS.find(c => c.value === item.sleeveCondition)
        : null;

    return (
        <dialog className="modal modal-middle px-2 sm:px-4" open={!!item}>
            <div className="modal-box max-w-lg w-full p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10 bg-base-300/60 hover:bg-base-300"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>

                {/* Cover + Title Header */}
                <div className="flex flex-col sm:flex-row gap-4 p-5 pb-0">
                    <img
                        src={getImageUrl(album.cover_image || '/placeholder-album.svg')}
                        alt={album.title}
                        className="w-full sm:w-36 sm:h-36 aspect-square object-cover rounded-lg shadow-lg mx-auto sm:mx-0 max-w-[200px]"
                    />
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                        <h2 className="text-xl font-bold leading-tight line-clamp-2">{album.title}</h2>
                        <p className="text-base text-base-content/70 mt-0.5">{stripArtistSuffix(album.artist)}</p>

                        {labels.length > 0 && (
                            <p className="text-xs text-base-content/50 mt-1">
                                {labels[0].name}
                                {labels[0].catno && labels[0].catno !== 'none' && (
                                    <span> &middot; {labels[0].catno}</span>
                                )}
                            </p>
                        )}

                        {/* Year + Format inline */}
                        <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3">
                            {album.year && (
                                <span className="badge badge-sm">{album.year}</span>
                            )}
                            <span className="badge badge-sm badge-primary">{item.format.name}</span>
                        </div>
                    </div>
                </div>

                {/* Content body */}
                <div className="px-5 pt-4 pb-5 space-y-4">

                    {/* Format details with color scheme */}
                    {(item.format.text || (item.format.descriptions && item.format.descriptions.length > 0)) && (
                        <div>
                            <h4 className="text-[11px] font-semibold text-base-content/50 uppercase tracking-wider mb-1.5">
                                {t('album.formatDetails')}
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {item.format.text && (
                                    <span
                                        className="badge badge-sm border"
                                        style={getFormatButtonStyle(item.format.text, [])}
                                    >
                                        {item.format.text}
                                    </span>
                                )}
                                {item.format.descriptions?.map((desc, i) => (
                                    <span
                                        key={i}
                                        className="badge badge-sm border"
                                        style={getFormatButtonStyle(desc, [])}
                                    >
                                        {desc}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Styles / Genres */}
                    {styles.length > 0 && (
                        <div>
                            <h4 className="text-[11px] font-semibold text-base-content/50 uppercase tracking-wider mb-1.5">
                                {t('album.genres')}
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {styles.map((style, i) => (
                                    <span key={i} className="badge badge-sm badge-primary badge-outline">{style}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Info grid: Condition + Value + Added */}
                    {(item.mediaCondition || item.sleeveCondition || value > 0 || item.addedAt) && (
                        <div className="grid grid-cols-2 gap-2">
                            {/* Media Condition */}
                            {item.mediaCondition && mediaLabel && (
                                <div className="bg-base-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-base-content/50 uppercase tracking-wider">{t('condition.media')}</div>
                                    <div className="text-sm font-semibold mt-0.5">{t(mediaLabel.labelKey)}</div>
                                </div>
                            )}

                            {/* Sleeve Condition */}
                            {item.sleeveCondition && sleeveLabel && (
                                <div className="bg-base-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-base-content/50 uppercase tracking-wider">{t('condition.sleeve')}</div>
                                    <div className="text-sm font-semibold mt-0.5">{t(sleeveLabel.labelKey)}</div>
                                </div>
                            )}

                            {/* Market Value */}
                            {value > 0 && (
                                <div className="bg-base-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-base-content/50 uppercase tracking-wider">{t('stats.value')}</div>
                                    <div className="text-sm font-semibold text-warning mt-0.5">
                                        {formatValue(value, item.priceCache?.currency || 'USD')}
                                    </div>
                                </div>
                            )}

                            {/* Added Date */}
                            {item.addedAt && (
                                <div className="bg-base-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-base-content/50 uppercase tracking-wider">{t('collection.added')}</div>
                                    <div className="text-sm font-semibold mt-0.5">
                                        {new Date(item.addedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tracklist preview (collapsed) */}
                    {album.tracklist && album.tracklist.length > 0 && (
                        <details className="collapse collapse-arrow bg-base-200 rounded-lg">
                            <summary className="collapse-title text-sm font-semibold min-h-0 !py-2 px-3 flex items-center after:!top-[50%] after:!-translate-y-1/2">
                                {t('album.tracklist')} ({album.tracklist.length})
                            </summary>
                            <div className="collapse-content px-3 pb-2">
                                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                    {album.tracklist.map((track, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                                            <span className="text-base-content/40 font-mono w-6 text-right shrink-0">{track.position}</span>
                                            <span className="truncate flex-1">{track.title}</span>
                                            {track.duration && (
                                                <span className="text-base-content/40 font-mono shrink-0">{track.duration}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </details>
                    )}

                    {/* External Links */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <a
                            href={spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-success btn-sm flex-1"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                            </svg>
                            {t('album.listenOnSpotify')}
                        </a>
                        {discogsUrl && (
                            <a
                                href={discogsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline btn-sm flex-1"
                            >
                                {t('album.viewOnDiscogs')}
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

export default PublicAlbumModal;
