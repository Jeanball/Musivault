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

/** An act on the bill, as returned by the event detail endpoint. */
export interface ConcertAct {
    tmId: string;
    name: string;
    imageUrl?: string;
    genre?: string;
    subGenre?: string;
    url?: string;
    /** Only the links Ticketmaster actually carried for this act. */
    links: Partial<Record<
        'spotify' | 'musicbrainz' | 'lastfm' | 'itunes' | 'youtube' | 'instagram' | 'facebook' | 'twitter' | 'wiki' | 'homepage',
        string
    >>;
    /** True when the user already owns records from this act. */
    owned: boolean;
}

export interface ConcertPresale {
    name?: string;
    url?: string;
    startDateTime?: string;
    endDateTime?: string;
}

export interface ConcertPriceRange {
    type?: string;
    currency?: string;
    min?: number;
    max?: number;
}

export interface ConcertVenueDetails {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    lat?: number;
    lon?: number;
    url?: string;
    boxOfficeInfo?: string;
    openHours?: string;
    acceptedPayment?: string;
    willCall?: string;
    parkingDetail?: string;
    accessibleSeatingDetail?: string;
    generalRule?: string;
    childRule?: string;
}

/**
 * The long form of a concert, fetched only when its modal opens: everything too
 * bulky to carry in the list, plus the full bill with per-act links.
 */
export interface ConcertDetails {
    tmId: string;
    name: string;
    url: string;
    imageUrl?: string;
    info?: string;
    pleaseNote?: string;
    ticketLimit?: string;
    accessibility?: string;
    seatmapUrl?: string;
    ageRestricted?: boolean;
    startLocalDate?: string;
    startLocalTime?: string;
    dateTBA: boolean;
    timeTBA: boolean;
    timezone?: string;
    status?: string;
    endLocalDate?: string;
    doorsLocalTime?: string;
    onSaleStart?: string;
    onSaleEnd?: string;
    presales: ConcertPresale[];
    priceRanges: ConcertPriceRange[];
    promoters: string[];
    venue?: ConcertVenueDetails;
    lineup: ConcertAct[];
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
