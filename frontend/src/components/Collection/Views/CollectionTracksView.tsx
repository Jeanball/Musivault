import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrackAggregation } from '../../../hooks/collection/useTrackAggregation';
import GroupedReleaseList from '../GroupedReleaseList';
import ListToolbar from '../ListToolbar';
import type { CollectionItem } from '../../../types/collection.types';

type TrackSort = 'appearances' | 'title' | 'artist';

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
    // Copies first by default: an A-Z index of every track is what the search
    // field is for, whereas "which songs do I own twice" has no other answer.
    const [sortBy, setSortBy] = useState<TrackSort>('appearances');

    const filteredTracks = useMemo(() => {
        const lowerSearch = searchTerm.trim().toLowerCase();
        const matching = lowerSearch
            ? aggregatedTracks.filter(
                (track) =>
                    track.title.toLowerCase().includes(lowerSearch) ||
                    track.artist.toLowerCase().includes(lowerSearch)
            )
            : aggregatedTracks;

        // The hook hands them over alphabetically, which is the 'title' order.
        if (sortBy === 'title') return matching;
        if (sortBy === 'artist') {
            return [...matching].sort(
                (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
            );
        }
        return [...matching].sort(
            (a, b) => b.albumCount - a.albumCount || a.title.localeCompare(b.title)
        );
    }, [aggregatedTracks, searchTerm, sortBy]);

    return (
        <div className="space-y-4">
            <ListToolbar
                summary={`${t('tracks.uniqueTracks', { count: filteredTracks.length })}${searchTerm ? ` ${t('tracks.matching', { term: searchTerm })}` : ''}`}
                sortValue={sortBy}
                onSortChange={setSortBy}
                sortLabel={t('tracks.sortBy')}
                options={[
                    { value: 'appearances', label: t('tracks.sortAppearances') },
                    { value: 'title', label: t('tracks.sortTitle') },
                    { value: 'artist', label: t('tracks.sortArtist') },
                ]}
            />

            {filteredTracks.length === 0 ? (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-semibold">{t('tracks.noTracksFound')}</h2>
                    <p className="mt-2 text-base-content/70">{t('tracks.tryDifferent')}</p>
                </div>
            ) : (
                <GroupedReleaseList
                    groups={filteredTracks.map((track) => ({ ...track, releases: track.albums }))}
                    expandedId={expandedTrackId}
                    onToggle={(id) => setExpandedTrackId(expandedTrackId === id ? null : id)}
                    onSelect={onAlbumClick}
                    renderHeader={(track) => (
                        <div className="min-w-0">
                            <div className="font-semibold truncate" title={track.title}>{track.title}</div>
                            <div className="text-sm text-base-content/60 truncate">{track.artist}</div>
                        </div>
                    )}
                />
            )}
        </div>
    );
};

export default CollectionTracksView;
