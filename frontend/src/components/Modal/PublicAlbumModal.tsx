import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionItem } from '../../types/collection.types';
import { getItemValue } from '../../utils/itemValue';
import { getImageUrl } from '../../utils/imageUrl';
import { stripArtistSuffix } from '../../utils/formatters';
import FormatColorBadge from '../Common/FormatColorBadge';
import FieldRow from '../Common/FieldRow';
import { useCurrency } from '../../hooks/useCurrency';
import { SPOTIFY_BUTTON_STYLE, DISCOGS_BUTTON_STYLE } from '../../utils/brandColors';
import { MEDIA_CONDITIONS, SLEEVE_CONDITIONS } from '../../utils/conditions';

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
                        className="w-full sm:w-36 sm:h-36 aspect-square object-cover border border-base-300 mx-auto sm:mx-0 max-w-[200px]"
                    />
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">{item.format.name}</span>
                        <h2 className="text-xl font-bold leading-tight line-clamp-2 mt-1">{album.title}</h2>
                        <p className="text-base text-base-content/70 mt-0.5">{stripArtistSuffix(album.artist)}</p>

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
                    </div>
                </div>

                {/* Content body */}
                <div className="px-5 pt-4 pb-5">

                    <div className="mb-4">
                        {labels.length > 0 && (
                            <FieldRow label={t('album.label')}>
                                {labels[0].name}
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
                                <span className="font-mono text-lg font-bold tabular-nums text-warning">
                                    {formatValue(value, item.priceCache?.currency || 'USD')}
                                </span>
                            </FieldRow>
                        )}
                    </div>

                    {/* Tracklist */}
                    {album.tracklist && album.tracklist.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-1">
                                {t('album.tracklist')}{' '}
                                <span className="normal-case font-normal">({album.tracklist.length})</span>
                            </h3>
                            <div className="border-t border-base-300 max-h-48 overflow-y-auto">
                                {album.tracklist.map((track, i) => (
                                    <div key={i} className="flex items-baseline gap-2 py-1 border-b border-base-300 text-sm">
                                        <span className="font-mono text-xs text-base-content/50 w-6 shrink-0">{track.position}</span>
                                        <span className="flex-1 min-w-0 truncate" title={track.title}>{track.title}</span>
                                        <span className="font-mono tabular-nums text-xs text-base-content/50 shrink-0">{track.duration || '—'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* External Links */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <a
                            href={spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm flex-1"
                            style={SPOTIFY_BUTTON_STYLE}
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
                                className="btn btn-sm flex-1"
                                style={DISCOGS_BUTTON_STYLE}
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M1.7422 11.982c0-5.6682 4.61-10.2782 10.2758-10.2782 1.8238 0 3.5372.48 5.0251 1.3175l.8135-1.4879C16.1768.588 14.2474.036 12.1908.0024h-.1944C5.4091.0144.072 5.3107 0 11.886v.1152c.0072 3.4389 1.4567 6.5345 3.7748 8.7207l1.1855-1.2814c-1.9798-1.8743-3.218-4.526-3.218-7.4585zM20.362 3.4053l-1.1543 1.2406c1.903 1.867 3.0885 4.4636 3.0885 7.3361 0 5.6658-4.61 10.2758-10.2758 10.2758-1.783 0-3.4605-.456-4.922-1.2575l-.8542 1.5214c1.7086.9384 3.6692 1.4735 5.7546 1.4759C18.6245 23.9976 24 18.6246 24 11.9988c-.0048-3.3717-1.399-6.4146-3.638-8.5935zM1.963 11.982c0 2.8701 1.2119 5.4619 3.146 7.2953l1.1808-1.2767c-1.591-1.5166-2.587-3.6524-2.587-6.0186 0-4.586 3.7293-8.3152 8.3152-8.3152 1.483 0 2.875.3912 4.082 1.0751l.8351-1.5262C15.481 2.395 13.8034 1.927 12.018 1.927 6.4746 1.9246 1.963 6.4362 1.963 11.982zm18.3702 0c0 4.586-3.7293 8.3152-8.3152 8.3152-1.4327 0-2.7837-.3648-3.962-1.0055l-.852 1.5166c1.4303.7823 3.0718 1.2287 4.814 1.2287 5.5434 0 10.055-4.5116 10.055-10.055 0-2.8077-1.1567-5.3467-3.0165-7.1729l-1.183 1.2743c1.519 1.507 2.4597 3.5924 2.4597 5.8986zm-1.9486 0c0 3.5109-2.8558 6.3642-6.3642 6.3642a6.3286 6.3286 0 01-3.0069-.756l-.8471 1.507c1.147.624 2.4597.9768 3.854.9768 4.4636 0 8.0944-3.6308 8.0944-8.0944 0-2.239-.9143-4.2692-2.3902-5.7378l-1.1783 1.267c1.1351 1.152 1.8383 2.731 1.8383 4.4732zm-14.4586 0c0 2.3014.9671 4.382 2.515 5.8578l1.1734-1.2695c-1.207-1.159-1.9606-2.786-1.9606-4.5883 0-3.5108 2.8557-6.3642 6.3642-6.3642 1.1423 0 2.215.3048 3.1437.8352l.8303-1.5167c-1.1759-.6647-2.5317-1.0487-3.974-1.0487-4.4612 0-8.092 3.6308-8.092 8.0944zm12.5292 0c0 2.4502-1.987 4.4372-4.4372 4.4372a4.4192 4.4192 0 01-2.0614-.5088l-.8351 1.4879a6.1135 6.1135 0 002.8965.727c3.3885 0 6.1434-2.7548 6.1434-6.1433 0-1.6774-.6767-3.1989-1.7686-4.3076l-1.1615 1.2503c.7559.7967 1.2239 1.8718 1.2239 3.0573zm-10.5806 0c0 1.7374.7247 3.3069 1.8886 4.4252L8.92 15.1569l.0144.0144c-.8351-.8063-1.3559-1.9366-1.3559-3.1869 0-2.4502 1.9846-4.4372 4.4372-4.4372.8087 0 1.5646.2184 2.2174.5976l.8207-1.4975a6.097 6.097 0 00-3.0381-.8063c-3.3837-.0048-6.141 2.7525-6.141 6.141zm6.681 0c0 .2952-.2424.5351-.5376.5351-.2952 0-.5375-.24-.5375-.5351 0-.2976.24-.5375.5375-.5375.2952 0 .5375.24.5375.5375zm-3.9405 0c0-1.879 1.5239-3.4029 3.4005-3.4029 1.879 0 3.4005 1.5215 3.4005 3.4029 0 1.879-1.5239 3.4005-3.4005 3.4005S8.6151 13.861 8.6151 11.982zm.1488 0c.0048 1.7974 1.4567 3.2493 3.2517 3.2517 1.795 0 3.254-1.4567 3.254-3.2517-.0023-1.7974-1.4566-3.2517-3.254-3.254-1.795 0-3.2517 1.4566-3.2517 3.254Z" />
                                </svg>
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
