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
