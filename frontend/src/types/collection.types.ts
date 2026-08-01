import type { FormatDetails } from './album.types';
import type { CustomFieldValues } from './customFields.types';

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

export interface PriceCache {
    mint?: number;
    nearMint?: number;
    veryGoodPlus?: number;
    veryGood?: number;
    goodPlus?: number;
    good?: number;
    fair?: number;
    poor?: number;
    currency: string;
    updatedAt?: string;
}

export interface FormatVerification {
    status: 'match' | 'mismatch' | 'unknown' | 'error';
    reasonCode?: string | null;
    detectedDiscogsFormat?: string | null;
    checkedAt?: string | null;
    ignoredAt?: string | null;
}

export interface CollectionItem {
    _id: string;
    album: Album;
    format: FormatDetails;
    mediaCondition?: string | null;
    sleeveCondition?: string | null;
    priceCache?: PriceCache | null;
    formatVerification?: FormatVerification | null;
    customFields?: CustomFieldValues | null;
    addedAt: string;
}

export type SortColumn = 'artist' | 'album' | 'year' | 'format' | 'addedAt' | 'price';
export type SortOrder = 'asc' | 'desc';
export type LayoutType = 'grid' | 'list' | 'table';

export interface FilterState {
    format: string;
    decade: string;
    addedPeriod: string;
    style: string;
    issueStatus: string;
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
    totalValue: number;
    valueCurrency: string;
    itemsWithValue: number;
}
