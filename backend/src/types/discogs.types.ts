/**
 * Discogs API type definitions
 * Centralized interfaces for all Discogs-related data structures
 */

// ===== Search Results =====

export interface DiscogsSearchResult {
    id: number;
    title: string;
    year: string;
    thumb: string;
    type: 'master' | 'release';
}

export interface DiscogsSearchResultExtended extends DiscogsSearchResult {
    master_id?: number; // Present on releases that have a master
    cover_image?: string;
    // Pressing details Discogs already returns with every search hit
    format?: string[];
    label?: string[];
    country?: string;
    catno?: string;
}

// ===== Release Details =====

export interface DiscogsFormat {
    name: string;
    qty: string;
    text?: string;
    descriptions?: string[];
}

export interface DiscogsTrack {
    position: string;
    title: string;
    duration: string;
    artists?: { name: string }[];
}

export interface DiscogsLabel {
    id?: number;
    name: string;
    catno?: string;
}

/** Raw response of GET /labels/{id} */
export interface DiscogsLabelResponse {
    id: number;
    name: string;
    profile?: string;
    /** Official websites of the label, most relevant first */
    urls?: string[];
    /** Discogs page of the label */
    uri?: string;
    images?: { type: string; uri: string; uri150?: string }[];
}

/** Label info exposed to the frontend */
export interface CleanedLabelInfo {
    discogsId: number;
    name: string;
    profile: string;
    /** Best guess at the label's own website, empty when unknown */
    officialUrl: string;
    /** Every external link Discogs knows about (socials, Bandcamp, ...) */
    urls: string[];
    discogsUrl: string;
    image: string;
}

export interface DiscogsReleaseResponse {
    id: number;
    master_id?: number;
    title: string;
    artists: { name: string }[];
    year: string;
    images: { type: string; uri: string; uri150?: string }[];
    formats: DiscogsFormat[];
    styles?: string[];
    tracklist?: DiscogsTrack[];
    labels?: DiscogsLabel[];
}

// ===== Master/Versions =====

export interface DiscogsMasterDetailsResponse {
    title: string;
    main_release?: number;
    images?: { uri: string }[];
    filter_facets?: { id: string; values: { value: string; count: number }[] }[];
}

export interface DiscogsVersion {
    id: number;
    title: string;
    format: string;
    label: string;
    country: string;
    released: string;
    major_formats: string[];
}

export interface DiscogsMasterVersionsResponse {
    versions: DiscogsVersion[];
    pagination?: { pages: number };
}

// ===== Artist =====

export interface DiscogsArtistResponse {
    name: string;
    images?: { uri: string }[];
}

export interface DiscogsArtistRelease {
    id: number;
    title: string;
    year: number;
    thumb: string;
    type: string;
    role: string;
    artist: string;
    main_release?: number;
    format?: string;
}

export interface DiscogsArtistReleasesResponse {
    releases: DiscogsArtistRelease[];
    pagination?: { pages: number };
}

export interface DiscogsMasterSearchResponse {
    results: DiscogsSearchResultExtended[];
    pagination?: { pages: number };
}

/** An album or EP, versus a single or a derived pressing (promo, test pressing). */
export type ArtistReleaseCategory = 'album' | 'other';

/** How much of a discography to load: the fast default, or every credit. */

// ===== API Response Types (cleaned for frontend) =====

export interface CleanedSearchResult {
    id: number;
    title: string;
    year: string;
    thumb: string;
    type: 'master' | 'release';
    /** Format descriptors ("Vinyl", "LP", "Album"), so a pressing can be told apart in the list */
    format?: string[];
    /** First label only: search hits list every reissue label and the rest is noise here */
    label?: string;
    country?: string;
    catno?: string;
}

export interface CleanedReleaseDetails {
    discogsId: number;
    master_id?: number;
    title: string;
    artist: string;
    year: string;
    cover_image: string;
    styles: string[];
    availableFormats: {
        name: string;
        descriptions: string[];
        text: string;
    }[];
    tracklist: {
        position: string;
        title: string;
        duration: string;
        artist: string;
    }[];
    labels: {
        discogsId?: number;
        name: string;
        catno: string;
    }[];
}

export interface CleanedMasterVersions {
    masterTitle: string;
    coverImage: string;
    main_release?: number;
    formatCounts: { [key: string]: number };
    countryCounts: { [key: string]: number };
    versions: {
        id: number;
        title: string;
        format: string;
        label: string;
        country: string;
        released: string;
        majorFormat: string;
    }[];
}

export interface CleanedArtistReleases {
    artist: {
        id: string;
        name: string;
        image: string;
    };
    albums: {
        id: number;
        title: string;
        year: number;
        thumb: string;
        type: 'master' | 'release';
        category: ArtistReleaseCategory;
    }[];
}

// ===== Service Types =====

export interface FoundAlbumInfo {
    discogsId: number;
    title: string;
    artist: string;
    year: string;
    thumb: string;
    cover_image: string;
    format?: 'Vinyl' | 'CD';
}

/** Marketplace price suggestions, one amount per condition grade. */
export interface MarketplaceStats {
    mint: number | null;
    nearMint: number | null;
    veryGoodPlus: number | null;
    veryGood: number | null;
    goodPlus: number | null;
    good: number | null;
    fair: number | null;
    poor: number | null;
    currency: string;
}
