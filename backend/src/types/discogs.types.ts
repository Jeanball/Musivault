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
    name: string;
    catno?: string;
}

export interface DiscogsReleaseResponse {
    id: number;
    title: string;
    artists: { name: string }[];
    year: string;
    images: { type: string; uri: string }[];
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
}

// ===== API Response Types (cleaned for frontend) =====

export interface CleanedSearchResult {
    id: number;
    title: string;
    year: string;
    thumb: string;
    type: 'master' | 'release';
}

export interface CleanedReleaseDetails {
    discogsId: number;
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
