/**
 * Folding for free-text filters over catalogue data.
 *
 * Ticketmaster and Discogs disagree on how an act is spelled far more often
 * than a user typing its name does: "Björk" is listed as "Bjork" about as often
 * as not, and "AC/DC" as "ACDC". A raw `toLowerCase().includes()` turns each of
 * those into an empty result page, so both the needle and the haystack are
 * flattened to bare letters and digits first.
 *
 * Not the same thing as normalizeArtistName on the server: that one also drops
 * Discogs' disambiguation suffix and leading articles, which would be wrong
 * here — this folds a whole phrase, venue and city names included.
 */
export const foldForSearch = (value: string): string =>
    value
        .toLowerCase()
        // Split accented characters into base letter + combining mark, then drop the marks.
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

/** Splits a phrase into accent-free words, keeping the word boundaries. */
const splitWords = (value: string): string[] =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

/** The words a user typed, usable even when a word is not complete yet. */
export const getSearchTerms = (query: string): string[] => splitWords(query);

/**
 * Discogs-style free-text matching: every word of the query has to appear,
 * even as a prefix, in at least one of the fields. Different words may match
 * different fields ("miles davis kind blue" finds "Miles Davis – Kind of Blue"),
 * and "kind blue" finds "Kind of Blue" without typing "of".
 *
 * The folded whole-field check also handles spellings that differ only by
 * punctuation, such as "AC/DC" and "acdc", which the word split cannot match.
 */
export const matchesSearchTerms = (
    terms: readonly string[],
    fields: readonly (string | null | undefined)[]
): boolean => {
    if (terms.length === 0) return true;

    const searchable = fields.filter((field): field is string => !!field);
    const words = searchable.flatMap(splitWords);
    if (terms.every((term) => words.some((word) => word.startsWith(term)))) {
        return true;
    }

    const foldedQuery = terms.join('');
    return searchable.some((field) => foldForSearch(field).includes(foldedQuery));
};
