/**
 * Shared artist-name ordering for the collection views, so the table, the grid
 * and the tracks list stay in agreement.
 *
 * English articles only: "Los Lobos" and "La Femme" are real names, and a
 * multilingual list would scatter them under the wrong letter.
 */
const LEADING_ARTICLES = ['the', 'a', 'an'];

/**
 * Lower-cased sort key for a name. With the preference off this is the plain
 * lower-cased name, so enabling the toggle is the only observable change.
 * A name that is nothing but an article keeps it, rather than sorting on "".
 */
export const artistSortKey = (name: string, ignoreLeadingArticle: boolean): string => {
    const lower = name.toLowerCase();
    if (!ignoreLeadingArticle) return lower;

    const separator = lower.indexOf(' ');
    if (separator === -1) return lower;

    const rest = lower.slice(separator + 1).trim();
    if (!rest || !LEADING_ARTICLES.includes(lower.slice(0, separator))) return lower;

    return rest;
};

/** Ascending comparator for artist names. */
export const compareArtistNames = (a: string, b: string, ignoreLeadingArticle: boolean): number =>
    artistSortKey(a, ignoreLeadingArticle).localeCompare(artistSortKey(b, ignoreLeadingArticle));
