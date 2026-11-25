/**
 * Price cache utilities
 * TTL-based staleness checking for Discogs price data
 */

import type { IPriceCache } from '../models/CollectionItem';
import type { MarketplaceStats } from '../types/discogs.types';

// Default: 7 days (168 hours)
const DEFAULT_PRICE_TTL_HOURS = 168;
/** Off by default: the seller price suggestions remain the authoritative source. */
const DEFAULT_PRICE_FALLBACK_ENABLED = false;

/**
 * Get the configured price cache TTL in hours.
 * Reads from PRICE_CACHE_TTL_HOURS environment variable, defaults to 168 (7 days).
 */
export function getPriceTTLHours(): number {
  const envVal = process.env.PRICE_CACHE_TTL_HOURS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_PRICE_TTL_HOURS;
}

/**
 * Whether Discogs price suggestions may fall back to the marketplace's lowest
 * listing price when they are unavailable (for example on accounts without
 * seller settings). Accepts the usual boolean spellings, case-insensitively.
 */
export function isPriceFallbackEnabled(): boolean {
    const raw = process.env.DISCOGS_PRICE_FALLBACK;
    if (raw == null || raw.trim() === '') return DEFAULT_PRICE_FALLBACK_ENABLED;
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

/**
 * Check if a price cache entry is stale based on its updatedAt timestamp.
 * Returns true if the price should be refreshed.
 */
export function isPriceStale(updatedAt?: Date | string | null): boolean {
  if (!updatedAt) return true;
  const ttlMs = getPriceTTLHours() * 60 * 60 * 1000;
  return Date.now() - new Date(updatedAt).getTime() > ttlMs;
}

/** Turn marketplace price suggestions into the price cache stored on a collection item */
export function buildPriceCache(stats: MarketplaceStats | null): IPriceCache | undefined {
  if (!stats) return undefined;

  return {
    mint: stats.mint ?? undefined,
    nearMint: stats.nearMint ?? undefined,
    veryGoodPlus: stats.veryGoodPlus ?? undefined,
    veryGood: stats.veryGood ?? undefined,
    goodPlus: stats.goodPlus ?? undefined,
    good: stats.good ?? undefined,
    fair: stats.fair ?? undefined,
    poor: stats.poor ?? undefined,
    currency: stats.currency,
    updatedAt: new Date(),
  };
}
