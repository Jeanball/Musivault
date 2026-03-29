/**
 * Price cache utilities
 * TTL-based staleness checking for Discogs price data
 */

// Default: 7 days (168 hours)
const DEFAULT_PRICE_TTL_HOURS = 168;

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
 * Check if a price cache entry is stale based on its updatedAt timestamp.
 * Returns true if the price should be refreshed.
 */
export function isPriceStale(updatedAt?: Date | string | null): boolean {
  if (!updatedAt) return true;
  const ttlMs = getPriceTTLHours() * 60 * 60 * 1000;
  return Date.now() - new Date(updatedAt).getTime() > ttlMs;
}
