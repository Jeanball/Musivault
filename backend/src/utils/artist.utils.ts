/**
 * Artist-name normalisation, for matching a Discogs credit against a
 * Ticketmaster performer.
 *
 * The two catalogues spell the same act differently often enough that a plain
 * string comparison misses most of them: Discogs appends a disambiguation
 * number to duplicate names ("Nirvana (2)"), keeps diacritics Ticketmaster
 * frequently drops ("Björk" / "Bjork"), and the two disagree on leading
 * articles and punctuation.
 */

/** Collection entries that are placeholders, not acts anyone can go see. */
const NON_ARTISTS = new Set(['various', 'variousartists', 'unknownartist', 'noartist', 'unknown']);

export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    // Discogs disambiguation suffix: "Nirvana (2)".
    .replace(/\s*\(\d+\)\s*$/, '')
    // Split accented characters into base letter + combining mark, then drop the marks.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/** True for the "Various" style placeholders that must never match an event. */
export function isPlaceholderArtist(name: string): boolean {
  const normalized = normalizeArtistName(name);
  return normalized.length === 0 || NON_ARTISTS.has(normalized);
}
