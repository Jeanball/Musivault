import { DISCOGS_STYLES, DISCOGS_STYLES_BY_GENRE } from '../constants/discogsGenres';

const DISCOGS_STYLE_SET = new Set<string>(DISCOGS_STYLES);

/** True for values that belong to the official Discogs style list. */
export const isDiscogsStyle = (value: string): boolean => DISCOGS_STYLE_SET.has(value);

/**
 * The style options that make sense for the chosen genres. With no genre
 * selected the whole Discogs list is offered, so a style can be entered first
 * if that is how the user thinks about the record. A style that Discogs lists
 * under several genres (Disco is both Funk / Soul and Electronic, for example)
 * stays available under each of them.
 */
export const getStylesForGenres = (genres: readonly string[]): readonly string[] => {
    if (genres.length === 0) return DISCOGS_STYLES;

    const allowed = new Set<string>();
    for (const genre of genres) {
        for (const style of DISCOGS_STYLES_BY_GENRE[genre] || []) {
            allowed.add(style);
        }
    }
    return DISCOGS_STYLES.filter((style) => allowed.has(style));
};

/**
 * Drops the picked styles that no longer belong to the chosen genres, while
 * keeping values that are not in the Discogs list at all: those come from old
 * data or a CSV import, and removing them here would lose information the user
 * never asked to change.
 */
export const pruneStylesForGenres = (
    styles: readonly string[],
    genres: readonly string[]
): string[] => {
    if (genres.length === 0) return [...styles];

    const allowed = new Set(getStylesForGenres(genres));
    return styles.filter((style) => !isDiscogsStyle(style) || allowed.has(style));
};
