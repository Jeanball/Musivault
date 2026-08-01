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
    publicShareId: string | null;
}

export interface ExchangeRates {
    baseCurrency: string;
    rates: Record<string, number>;
    lastUpdated: string;
}
