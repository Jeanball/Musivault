import type { FormatDetails } from '../components/Modal/AddAlbumVersionModal';

export interface Album {
    _id: string;
    title: string;
    artist: string;
    cover_image: string;
    thumb: string;
    year: string;
}

export interface CollectionItem {
    _id: string;
    album: Album;
    format: FormatDetails; 
    addedAt: string;
}

export type SortColumn = 'artist' | 'album' | 'year' | 'format' | 'addedAt';
export type SortOrder = 'asc' | 'desc';
export type LayoutType = 'grid' | 'list' | 'table';

export interface FilterState {
    format: string;
    decade: string;
    addedPeriod: string;
}

export interface CollectionStats {
    total: number;
    formatCounts: Record<string, number>;
    decadeCounts: Record<string, number>;
    recentAdds: {
        thisWeek: number;
        thisMonth: number;
    };
    topArtist: {
        name: string;
        count: number;
    } | null;
    availableFormats: string[];
    availableDecades: string[];
}
