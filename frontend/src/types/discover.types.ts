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
