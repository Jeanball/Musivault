/**
 * What the user typed, inferred from the text itself.
 *
 * The search used to ask for the mode up front (album / ID / catalog number),
 * which meant classifying the query before typing it. The query already carries
 * that information: a bare 5-9 digit number is a Discogs id, 12-13 digits is a
 * barcode, and letters followed by digits is a catalog number.
 */
export type SearchIntent =
    | { kind: 'text'; value: string }
    | { kind: 'discogsId'; value: string }
    | { kind: 'barcode'; value: string }
    | { kind: 'catno'; value: string };

/** Five digits minimum, so a year typed on its own stays a text search */
const DISCOGS_ID = /^\d{5,9}$/;
const BARCODE = /^\d{12,13}$/;
/** "CAD 0006", "BLP-1577", "SOMA LP 4": letters, then digits, optionally split */
const CATNO = /^[A-Za-z]{2,8}[\s-]?[A-Za-z]{0,4}[\s-]?\d{2,6}$/;

export function detectIntent(query: string): SearchIntent {
    const value = query.trim();

    if (BARCODE.test(value)) return { kind: 'barcode', value };
    if (DISCOGS_ID.test(value)) return { kind: 'discogsId', value };
    if (CATNO.test(value)) return { kind: 'catno', value: value.toUpperCase() };

    return { kind: 'text', value };
}
