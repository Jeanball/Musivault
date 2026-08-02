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
