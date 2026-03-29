import { useMemo } from 'react';
import type { CollectionItem, CollectionStats } from '../../types/collection.types';
import { getItemValue } from '../../types/collection.types';

const getTopEntry = (counts: Record<string, number>) => {
    let topName: string | null = null;
    let topCount = 0;

    for (const [name, count] of Object.entries(counts)) {
        if (count > topCount) {
            topName = name;
            topCount = count;
        }
    }

    return topName ? { name: topName, count: topCount } : null;
};

export const useCollectionStats = (collection: CollectionItem[]): CollectionStats => {
    return useMemo(() => {
        const total = collection.length;
        const now = new Date();
        const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const formatCounts: Record<string, number> = {};
        const decadeCounts: Record<string, number> = {};
        const styleCounts: Record<string, number> = {};
        const artistCounts: Record<string, number> = {};
        const recentAdds = {
            thisWeek: 0,
            thisMonth: 0
        };
        let totalValue = 0;
        let valueCurrency = 'USD';
        let itemsWithValue = 0;

        for (const item of collection) {
            const format = item.format.name;
            const artist = item.album.artist;
            const year = Number.parseInt(item.album.year, 10);
            const addedAt = new Date(item.addedAt);

            formatCounts[format] = (formatCounts[format] || 0) + 1;
            artistCounts[artist] = (artistCounts[artist] || 0) + 1;

            if (year) {
                const decade = Math.floor(year / 10) * 10;
                const decadeLabel = `${decade}s`;
                decadeCounts[decadeLabel] = (decadeCounts[decadeLabel] || 0) + 1;
            }

            if (addedAt >= thisWeek) {
                recentAdds.thisWeek += 1;
            }
            if (addedAt >= thisMonth) {
                recentAdds.thisMonth += 1;
            }

            if (item.album.styles) {
                for (const style of item.album.styles) {
                    styleCounts[style] = (styleCounts[style] || 0) + 1;
                }
            }

            const val = getItemValue(item);
            if (val > 0) {
                totalValue += val;
                valueCurrency = item.priceCache?.currency || 'USD';
                itemsWithValue++;
            }
        }

        const availableFormats = Object.keys(formatCounts).sort();
        const availableDecades = Object.keys(decadeCounts).sort();
        const availableStyles = Object.keys(styleCounts).sort();
        const topArtist = getTopEntry(artistCounts);
        const topStyle = getTopEntry(styleCounts);

        return {
            total,
            formatCounts,
            decadeCounts,
            styleCounts,
            recentAdds,
            topArtist,
            topStyle,
            availableFormats,
            availableDecades,
            availableStyles,
            totalValue: Math.round(totalValue * 100) / 100,
            valueCurrency,
            itemsWithValue
        };
    }, [collection]);
};
