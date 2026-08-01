import type { CollectionItem } from '../types/collection.types';

/**
 * Get the effective value for a collection item based on its media condition.
 * Matches mediaCondition to the stored per-condition price. Defaults to VG+.
 */
export function getItemValue(item: CollectionItem): number {
    if (!item.priceCache) return 0;
    const pc = item.priceCache;

    switch (item.mediaCondition) {
        case 'M': return pc.mint ?? pc.nearMint ?? 0;
        case 'NM': return pc.nearMint ?? pc.mint ?? 0;
        case 'VG+': return pc.veryGoodPlus ?? 0;
        case 'VG': return pc.veryGood ?? 0;
        case 'G+': return pc.goodPlus ?? 0;
        case 'G': return pc.good ?? 0;
        case 'F': return pc.fair ?? 0;
        case 'P': return pc.poor ?? 0;
        default: return pc.veryGoodPlus ?? pc.nearMint ?? 0;
    }
}
