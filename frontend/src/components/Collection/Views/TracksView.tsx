import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useTrackAggregation, type AggregatedTrack } from '../../../hooks/collection/useTrackAggregation';
import type { CollectionItem } from '../../../types/collection.types';

interface TracksViewProps {
    collection: CollectionItem[];
}

const TracksView: React.FC<TracksViewProps> = ({ collection }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const aggregatedTracks = useTrackAggregation(collection);
    const [searchTerm, setSearchTerm] = useState('');
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

    const handleAlbumClick = (collectionItemId: string) => {
        navigate(`/app/album/${collectionItemId}`);
    };

    return (
        <div className="space-y-4">
            {/* Search Input */}
            <div className="form-control">
                <input
                    type="text"
                    placeholder={t('tracks.searchTrack')}
                    className="input input-bordered w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Tracks Count */}
            <div className="text-sm text-base-content/60">
                {filteredTracks.length} {filteredTracks.length !== 1 ? t('tracks.uniqueTracks_plural', { count: filteredTracks.length }) : t('tracks.uniqueTracks', { count: filteredTracks.length })}
                {searchTerm && ` ${t('tracks.matching', { term: searchTerm })}`}
            </div>

            {/* Tracks List */}
            {filteredTracks.length === 0 ? (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold">{t('tracks.noTracksFound')}</h2>
                    <p className="mt-2 text-gray-400">{t('tracks.tryDifferent')}</p>
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
                                    <span className="badge badge-primary badge-sm shrink-0">
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
                                            onClick={() => handleAlbumClick(album.collectionItemId)}
                                            className="flex items-center gap-3 p-2 rounded-lg bg-base-300 hover:bg-primary/10 cursor-pointer transition-colors"
                                        >
                                            <img
                                                src={album.thumb || album.cover_image || '/placeholder-album.png'}
                                                alt={album.title}
                                                className="w-12 h-12 rounded object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = '/placeholder-album.png';
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{album.title}</div>
                                                <div className="text-sm text-base-content/60 truncate">
                                                    {album.artist} {album.year && `• ${album.year}`}
                                                </div>
                                            </div>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 text-base-content/40"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="2"
                                                    d="M9 5l7 7-7 7"
                                                />
                                            </svg>
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

export default TracksView;
