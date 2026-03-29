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
}

/**
 * Get the effective value for a collection item based on its media condition.
 * Matches mediaCondition to the stored per-condition price. Defaults to VG+.
 */
export function getItemValue(item: CollectionItem): number {
    if (!item.priceCache) return 0;
    const pc = item.priceCache;

    switch (item.mediaCondition) {
        case 'M': return pc.mint ?? pc.nearMint ?? 0;
        case 'NM': return pc.nearMint ?? pc.mint ?? 0;
        case 'VG+': return pc.veryGoodPlus ?? 0;
        case 'VG': return pc.veryGood ?? 0;
        case 'G+': return pc.goodPlus ?? 0;
        case 'G': return pc.good ?? 0;
        case 'F': return pc.fair ?? 0;
        case 'P': return pc.poor ?? 0;
        default: return pc.veryGoodPlus ?? pc.nearMint ?? 0;
    }
}

export interface CollectionItem {
    _id: string;
    album: Album;
    format: FormatDetails;
    mediaCondition?: string | null;
    sleeveCondition?: string | null;
    priceCache?: PriceCache | null;
    formatVerification?: FormatVerification | null;
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
