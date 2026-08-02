/**
 * Shape returned by GET /api/preferences: the user's stored preferences plus
 * publicShareId, which the backend only fills in when isPublic is true.
 */
export interface Preferences {
    theme: string;
    isPublic: boolean;
    wideScreenMode: boolean;
    language: string;
    enableConditionGrading: boolean;
    preferredCurrency: string;
    /** Styles unchecked in Discover's upcoming releases. Empty = show all. */
    discoverExcludedStyles: string[];
    /** Last position used by the "near you" sections, so we don't re-prompt every visit. */
    discoverLocation?: UserLocation | null;
    /** Search radius shared by every "near you" section — shops and concerts alike. */
    discoverRadiusKm: number;
    publicShareId: string | null;
}

export type LocationSource = 'browser' | 'ip' | 'manual';

export interface UserLocation {
    lat: number;
    lon: number;
    label?: string;
    source: LocationSource;
}

export interface ExchangeRates {
    baseCurrency: string;
    rates: Record<string, number>;
    lastUpdated: string;
}
