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

/**
 * Splits the query into AND groups separated by the OR keyword. Without OR
 * there is one group, so all the words must match; "miles davis OR kind blue"
 * becomes [['miles', 'davis'], ['kind', 'blue']] and either side is enough.
 * A leading, trailing or repeated OR is ignored.
 */
export const getSearchTermGroups = (query: string): string[][] => {
    const groups: string[][] = [[]];
    for (const term of splitWords(query)) {
        if (term === 'or') {
            if (groups[groups.length - 1].length > 0) groups.push([]);
            continue;
        }
        groups[groups.length - 1].push(term);
    }
    return groups.filter((group) => group.length > 0);
};

/**
 * Discogs-style free-text matching: every word of a group has to appear, even
 * as a prefix, in at least one of the fields. Different words may match
 * different fields ("miles davis kind blue" finds "Miles Davis – Kind of Blue"),
 * and "kind blue" finds "Kind of Blue" without typing "of". With several
 * groups separated by OR, matching any one of them is enough.
 *
 * The folded whole-field check also handles spellings that differ only by
 * punctuation, such as "AC/DC" and "acdc", which the word split cannot match.
 */
export const matchesSearchGroups = (
    groups: readonly (readonly string[])[],
    fields: readonly (string | null | undefined)[]
): boolean => {
    if (groups.length === 0) return true;

    const searchable = fields.filter((field): field is string => !!field);
    const words = searchable.flatMap(splitWords);

    return groups.some((terms) =>
        terms.every((term) => words.some((word) => word.startsWith(term))) ||
        searchable.some((field) => foldForSearch(field).includes(terms.join('')))
    );
};
