export interface UpcomingRelease {
    mbid: string;
    title: string;
    artist: string;
    firstReleaseDate: string;
    datePrecision: 'day' | 'month';
    primaryType: 'Album' | 'EP';
    secondaryTypes: string[];
    coverArtUrl?: string;
    matchedStyles: string[];
}

/** A record shop from OpenStreetMap, with its distance from the requested position. */
export interface RecordShop {
    osmType: 'node' | 'way' | 'relation';
    osmId: number;
    name: string;
    lat: number;
    lon: number;
    distanceKm: number;
    street?: string;
    city?: string;
    postcode?: string;
    country?: string;
    website?: string;
    phone?: string;
    openingHours?: string;
}

/** Why a concert was surfaced: an act the user owns, a genre they collect, or neither. */
export type ConcertMatchType = 'artist' | 'genre' | 'other';

/** A Ticketmaster music event, with its distance and its fit to the collection. */
export interface Concert {
    tmId: string;
    name: string;
    url: string;
    imageUrl?: string;
    /** "YYYY-MM-DD" in the venue's timezone. */
    startLocalDate: string;
    startLocalTime?: string;
    dateTBA: boolean;
    timeTBA: boolean;
    status?: string;
    genre?: string;
    subGenre?: string;
    priceMin?: number;
    priceMax?: number;
    priceCurrency?: string;
    venueName: string;
    venueCity?: string;
    lat: number;
    lon: number;
    distanceKm: number;
    attractions: string[];
    matchType: ConcertMatchType;
    /** Acts on the bill the user already owns records from. */
    matchedArtists: string[];
    /** The user's own styles that led to this event's genre. */
    matchedStyles: string[];
}

/**
 * Position guessed from the caller's IP. City-level at best and wrong behind a
 * VPN, so it is always presented as approximate.
 */
export type ApproximateLocation =
    | { source: 'ip'; lat: number; lon: number; city?: string; country?: string }
    | { source: 'unavailable' };

export interface GeocodeResult {
    lat: number;
    lon: number;
    label: string;
}
