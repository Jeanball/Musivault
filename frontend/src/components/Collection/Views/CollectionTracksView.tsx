import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { useTrackAggregation, type AggregatedTrack } from '../../../hooks/collection/useTrackAggregation';
import type { CollectionItem } from '../../../types/collection.types';
import { getImageUrl } from '../../../utils/imageUrl';

interface CollectionTracksViewProps {
    collection: CollectionItem[];
    /** Typed in the toolbar, which keeps its place across the view modes. */
    searchTerm: string;
    onAlbumClick: (collectionItemId: string) => void;
}

const CollectionTracksView: React.FC<CollectionTracksViewProps> = ({ collection, searchTerm, onAlbumClick }) => {
    const { t } = useTranslation();
    const aggregatedTracks = useTrackAggregation(collection);
    const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);

    const filteredTracks = useMemo(() => {
        if (!searchTerm.trim()) return aggregatedTracks;
        const lowerSearch = searchTerm.toLowerCase();
        return aggregatedTracks.filter(
            (track) =>
                track.title.toLowerCase().includes(lowerSearch) ||
                track.artist.toLowerCase().includes(lowerSearch)
        );
    }, [aggregatedTracks, searchTerm]);

    const handleTrackClick = (track: AggregatedTrack) => {
        setExpandedTrackId(expandedTrackId === track.id ? null : track.id);
    };

    return (
        <div className="space-y-4">
            {/* Tracks Count */}
            <div className="text-sm text-base-content/60">
                {filteredTracks.length} {filteredTracks.length !== 1 ? t('tracks.uniqueTracks_plural', { count: filteredTracks.length }) : t('tracks.uniqueTracks', { count: filteredTracks.length })}
                {searchTerm && ` ${t('tracks.matching', { term: searchTerm })}`}
            </div>

            {/* Tracks List */}
            {filteredTracks.length === 0 ? (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold">{t('tracks.noTracksFound')}</h2>
                    <p className="mt-2 text-base-content/70">{t('tracks.tryDifferent')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredTracks.map((track) => (
                        <div key={track.id} className="collapse collapse-arrow bg-base-200 rounded-box">
                            <input
                                type="checkbox"
                                checked={expandedTrackId === track.id}
                                onChange={() => handleTrackClick(track)}
                            />
                            <div className="collapse-title font-medium flex items-center gap-4 pr-12">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold truncate">{track.title}</div>
                                    <div className="text-sm text-base-content/60 truncate">{track.artist}</div>
                                </div>
                                {track.albumCount > 1 && (
                                    /* Ghost, not primary: a count of copies is a fact, not an action. */
                                    <span className="badge badge-ghost badge-sm shrink-0">
                                        {track.albumCount} {t('common.albums')}
                                    </span>
                                )}
                            </div>
                            <div className="collapse-content">
                                <div className="pt-2 space-y-2">
                                    <div className="text-sm text-base-content/60 mb-2">
                                        {track.albumCount !== 1 ? t('tracks.appearsOn_plural', { count: track.albumCount }) : t('tracks.appearsOn', { count: track.albumCount })}
                                    </div>
                                    {track.albums.map((album) => (
                                        <div
                                            key={album.collectionItemId}
                                            onClick={() => onAlbumClick(album.collectionItemId)}
                                            className="flex items-center gap-3 p-2 rounded-field bg-base-300 hover:bg-primary/10 cursor-pointer transition-colors"
                                        >
                                            {/* .svg, not .png: the png was never in public/, so a
                                                record without a thumb showed a broken image and the
                                                handler re-pointed at the same missing file. */}
                                            <img
                                                src={getImageUrl(album.thumb || album.cover_image || '/placeholder-album.svg')}
                                                alt={album.title}
                                                className="w-12 h-12 rounded-field object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = '/placeholder-album.svg';
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{album.title}</div>
                                                <div className="text-sm text-base-content/60 truncate">
                                                    {album.artist} {album.year && `• ${album.year}`}
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="shrink-0 text-base-content/40" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CollectionTracksView;
