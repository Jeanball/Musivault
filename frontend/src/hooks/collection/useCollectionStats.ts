import { useMemo } from 'react';
import type { CollectionItem, CollectionStats } from '../../types/collection';

export const useCollectionStats = (collection: CollectionItem[]): CollectionStats => {
    return useMemo(() => {
        const total = collection.length;
        
        // Répartition par format
        const formatCounts = collection.reduce((acc, item) => {
            const format = item.format.name;
            acc[format] = (acc[format] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Albums par décennie
        const decadeCounts = collection.reduce((acc, item) => {
            const year = parseInt(item.album.year);
            if (year) {
                const decade = Math.floor(year / 10) * 10;
                const decadeLabel = `${decade}s`;
                acc[decadeLabel] = (acc[decadeLabel] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        // Ajouts récents
        const now = new Date();
        const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const recentAdds = {
            thisWeek: collection.filter(item => new Date(item.addedAt) >= thisWeek).length,
            thisMonth: collection.filter(item => new Date(item.addedAt) >= thisMonth).length
        };

        // Artiste le plus représenté
        const artistCounts = collection.reduce((acc, item) => {
            const artist = item.album.artist;
            acc[artist] = (acc[artist] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const topArtist = Object.entries(artistCounts)
            .sort(([,a], [,b]) => b - a)[0];

        // Options disponibles pour les filtres
        const availableFormats = Object.keys(formatCounts).sort();
        const availableDecades = Object.keys(decadeCounts).sort();

        return {
            total,
            formatCounts,
            decadeCounts,
            recentAdds,
            topArtist: topArtist ? { name: topArtist[0], count: topArtist[1] } : null,
            availableFormats,
            availableDecades
        };
    }, [collection]);
};
