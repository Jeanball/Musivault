import type { FormatDetails } from '../components/Modal/AddAlbumVersionModal';

export interface Track {
    position: string;
    title: string;
    duration: string;
    artist?: string;
}

export interface Label {
    name: string;
    catno: string;
}

export interface Album {
    _id: string;
    title: string;
    artist: string;
    cover_image: string;
    thumb: string;
    year: string;
    discogsId?: number;
    styles?: string[];
    tracklist?: Track[];
    labels?: Label[];
}

export interface CollectionItem {
    _id: string;
    album: Album;
    format: FormatDetails;
    mediaCondition?: string | null;
    sleeveCondition?: string | null;
    addedAt: string;
}

export type SortColumn = 'artist' | 'album' | 'year' | 'format' | 'addedAt';
export type SortOrder = 'asc' | 'desc';
export type LayoutType = 'grid' | 'list' | 'table';

export interface FilterState {
    format: string;
    decade: string;
    addedPeriod: string;
    style: string;
}

export interface CollectionStats {
    total: number;
    formatCounts: Record<string, number>;
    decadeCounts: Record<string, number>;
    styleCounts: Record<string, number>;
    recentAdds: {
        thisWeek: number;
        thisMonth: number;
    };
    topArtist: {
        name: string;
        count: number;
    } | null;
    topStyle: {
        name: string;
        count: number;
    } | null;
    availableFormats: string[];
    availableDecades: string[];
    availableStyles: string[];
}
