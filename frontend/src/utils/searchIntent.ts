/**
 * What the user typed, inferred from the text itself.
 *
 * The search used to ask for the mode up front (album / ID / catalog number),
 * which meant classifying the query before typing it. The query already carries
 * that information: a bare 5-9 digit number is a Discogs id, 12-13 digits is a
 * barcode, letters followed by digits is a catalog number, and a Spotify album
 * link is an import request.
 */
export type SearchIntent =
    | { kind: 'text'; value: string }
    | { kind: 'discogsId'; value: string }
    | { kind: 'barcode'; value: string }
    | { kind: 'catno'; value: string }
    | { kind: 'spotifyUrl'; value: string };

/** Five digits minimum, so a year typed on its own stays a text search */
const DISCOGS_ID = /^\d{5,9}$/;
const BARCODE = /^\d{12,13}$/;
/** "CAD 0006", "BLP-1577", "SOMA LP 4": letters, then digits, optionally split */
const CATNO = /^[A-Za-z]{2,8}[\s-]?[A-Za-z]{0,4}[\s-]?\d{2,6}$/;
/** Localized web links, plain web links and the `spotify:album:` URI. */
const SPOTIFY_ALBUM = /^(?:https?:\/\/(?:open\.)?spotify\.com\/(?:[a-z]{2,8}(?:-[a-z]{2,4})?\/)?album\/|spotify:album:)[A-Za-z0-9]{22}(?:[/?#].*)?$/i;

export function detectIntent(query: string): SearchIntent {
    const value = query.trim();

    if (SPOTIFY_ALBUM.test(value)) return { kind: 'spotifyUrl', value };
    if (BARCODE.test(value)) return { kind: 'barcode', value };
    if (DISCOGS_ID.test(value)) return { kind: 'discogsId', value };
    if (CATNO.test(value)) return { kind: 'catno', value: value.toUpperCase() };

    return { kind: 'text', value };
}
