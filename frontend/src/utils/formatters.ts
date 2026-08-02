/**
 * Strips the Discogs artist suffix (e.g., " (2)") from an artist's name.
 * Example: "Alpha Wolf (2)" -> "Alpha Wolf"
 */
export const stripArtistSuffix = (name: string): string => {
    if (!name) return '';
    return name.replace(/\s\(\d+\)$/, '');
};

/** Under 10 km a decimal is meaningful; beyond that it is noise. */
export const formatDistance = (km: number, locale: string): string => {
    const value = km < 10 ? km.toFixed(1) : Math.round(km).toString();
    return new Intl.NumberFormat(locale).format(Number(value));
};

export const parseTitle = (fullTitle: string): { artist: string; album: string } => {
    const parts = fullTitle.split(' - ');
    if (parts.length > 1) {
        const album = parts.pop()?.trim() || fullTitle;
        const artist = stripArtistSuffix(parts.join(' - ').trim());
        return { artist, album };
    }
    return { artist: "", album: fullTitle };
};
