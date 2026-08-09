/**
 * Strips the disambiguation suffix Discogs appends to a name that isn't unique
 * (e.g. " (2)"). Applies to artists and labels alike — "Columbia (2)" and
 * "Columbia" are the same imprint and must group together.
 * Example: "Alpha Wolf (2)" -> "Alpha Wolf"
 */
export const stripDiscogsSuffix = (name: string): string => {
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
        const artist = stripDiscogsSuffix(parts.join(' - ').trim());
        return { artist, album };
    }
    return { artist: "", album: fullTitle };
};
