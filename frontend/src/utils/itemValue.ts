import type { CollectionItem, ConditionPrices } from '../types/collection.types';

/**
 * Pick the amount matching a condition grade. Falls back the way a grader would:
 * mint and near mint stand in for each other, anything unknown lands on VG+.
 */
export function getPriceForCondition(prices: ConditionPrices, condition?: string | null): number {
    switch (condition) {
        case 'M': return prices.mint ?? prices.nearMint ?? 0;
        case 'NM': return prices.nearMint ?? prices.mint ?? 0;
        case 'VG+': return prices.veryGoodPlus ?? 0;
        case 'VG': return prices.veryGood ?? 0;
        case 'G+': return prices.goodPlus ?? 0;
        case 'G': return prices.good ?? 0;
        case 'F': return prices.fair ?? 0;
        case 'P': return prices.poor ?? 0;
        default: return prices.veryGoodPlus ?? prices.nearMint ?? 0;
    }
}

/**
 * Get the effective value for a collection item based on its media condition.
 */
export function getItemValue(item: CollectionItem): number {
    if (!item.priceCache) return 0;
    return getPriceForCondition(item.priceCache, item.mediaCondition);
}
