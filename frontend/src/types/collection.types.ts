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
    /** Discogs label id, used to resolve the label's official website */
    discogsId?: number;
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

/**
 * One amount per condition grade. Shared by the prices stored on a collection
 * item and the live suggestions read from Discogs, so both can be priced and
 * rendered by the same helpers.
 */
export interface ConditionPrices {
    mint?: number | null;
    nearMint?: number | null;
    veryGoodPlus?: number | null;
    veryGood?: number | null;
    goodPlus?: number | null;
    good?: number | null;
    fair?: number | null;
    poor?: number | null;
    currency: string;
}

export interface PriceCache extends ConditionPrices {
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

export type SortColumn = 'artist' | 'album' | 'year' | 'format' | 'label' | 'addedAt' | 'price';
export type SortOrder = 'asc' | 'desc';
/** How the albums are drawn. */
export type LayoutType = 'grid' | 'list' | 'table';

/** What the collection page lists — a change of content, not of presentation. */
export type CollectionViewMode = 'albums' | 'tracks' | 'labels';

export interface FilterState {
    format: string;
    decade: string;
    addedPeriod: string;
    style: string;
    label: string;
    issueStatus: string;
}

export interface CollectionStats {
    total: number;
    formatCounts: Record<string, number>;
    decadeCounts: Record<string, number>;
    styleCounts: Record<string, number>;
    labelCounts: Record<string, number>;
    artistCounts: Record<string, number>;
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
    availableLabels: string[];
    topLabel: {
        name: string;
        count: number;
    } | null;
    /** USD, like the stored prices: converted once, on render. */
    totalValue: number;
    itemsWithValue: number;
}
