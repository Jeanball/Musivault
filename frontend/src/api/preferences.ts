import { client } from './client';
import type { Preferences, ExchangeRates } from '../types/preferences.types';

/**
 * Module-level cache with in-flight deduplication, same approach as the
 * exchange rates below. Preferences are read from the theme context, the
 * private layout and three settings panels, which previously fired four
 * separate GETs on a single settings visit.
 */
let cached: Preferences | null = null;
let inFlight: Promise<Preferences> | null = null;

export async function getPreferences(force = false): Promise<Preferences> {
    if (cached && !force) return cached;
    if (inFlight && !force) return inFlight;

    inFlight = client
        .get<Preferences>('/preferences')
        .then(({ data }) => {
            cached = data;
            return data;
        })
        .finally(() => {
            inFlight = null;
        });

    return inFlight;
}

/**
 * Sends a partial update and refreshes the cache with the server's answer.
 * PUT nests the preferences and returns publicShareId alongside them, so the
 * two are flattened here to match the shape getPreferences returns.
 */
export async function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
    const { data } = await client.put<{
        message: string;
        preferences: Omit<Preferences, 'publicShareId'>;
        publicShareId: string | null;
    }>('/preferences', patch);

    cached = { ...data.preferences, publicShareId: data.publicShareId };
    return cached;
}

/** Drops the cached preferences, e.g. when switching user. */
export function clearPreferencesCache(): void {
    cached = null;
    inFlight = null;
}

const FALLBACK_RATES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.35 };

let cachedRates: Record<string, number> | null = null;
let ratesInFlight: Promise<Record<string, number>> | null = null;

export async function getExchangeRates(): Promise<Record<string, number>> {
    if (cachedRates) return cachedRates;
    if (ratesInFlight) return ratesInFlight;

    ratesInFlight = client
        .get<ExchangeRates>('/preferences/exchange-rates')
        .then(({ data }) => {
            cachedRates = data.rates || { USD: 1 };
            return cachedRates;
        })
        .catch(err => {
            console.error('Failed to fetch exchange rates:', err);
            cachedRates = FALLBACK_RATES;
            return FALLBACK_RATES;
        })
        .finally(() => {
            ratesInFlight = null;
        });

    return ratesInFlight;
}
