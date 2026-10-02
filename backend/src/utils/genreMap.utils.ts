/**
 * Bridge between Discogs styles and Ticketmaster genres.
 *
 * Discogs describes a record with hundreds of fine-grained styles ("Hard Bop",
 * "Shoegaze", "Deep House"); Ticketmaster classifies a concert with one of ~24
 * coarse genres. Matching them is necessarily lossy, so this leans on exact
 * entries for the styles that actually turn up in collections and falls back to
 * keyword rules for the long tail rather than pretending to be exhaustive.
 */

/** Exact matches for the styles that come up most often in a vinyl collection. */
const STYLE_TO_TM_GENRE: Record<string, string> = {
  // Rock family
  'Rock & Roll': 'Rock', 'Classic Rock': 'Rock', 'Prog Rock': 'Rock', 'Psychedelic Rock': 'Rock',
  'Hard Rock': 'Rock', 'Garage Rock': 'Rock', 'Arena Rock': 'Rock', 'Southern Rock': 'Rock',
  'Rockabilly': 'Rock', 'Surf': 'Rock', 'Punk': 'Rock', 'Post-Punk': 'Rock',
  'Emo': 'Alternative', 'Indie Rock': 'Alternative', 'Alternative Rock': 'Alternative',
  'Shoegaze': 'Alternative', 'Grunge': 'Alternative', 'Post-Rock': 'Alternative', 'Noise': 'Alternative',
  'Math Rock': 'Alternative', 'Krautrock': 'Alternative',
  // Metal
  'Heavy Metal': 'Metal', 'Death Metal': 'Metal', 'Black Metal': 'Metal', 'Thrash': 'Metal',
  'Doom Metal': 'Metal', 'Sludge Metal': 'Metal', 'Nu Metal': 'Metal', 'Speed Metal': 'Metal',
  'Hardcore': 'Metal', 'Melodic Hardcore': 'Metal', 'Post-Hardcore': 'Metal', 'Metalcore': 'Metal',
  'Deathcore': 'Metal', 'Mathcore': 'Metal', 'Grindcore': 'Metal',
  // Electronic
  'House': 'Dance/Electronic', 'Deep House': 'Dance/Electronic', 'Techno': 'Dance/Electronic',
  'Trance': 'Dance/Electronic', 'Ambient': 'Dance/Electronic', 'Downtempo': 'Dance/Electronic',
  'Drum n Bass': 'Dance/Electronic', 'Dubstep': 'Dance/Electronic', 'IDM': 'Dance/Electronic',
  'Electro': 'Dance/Electronic', 'Synth-pop': 'Pop', 'Italo-Disco': 'Dance/Electronic',
  'Breakbeat': 'Dance/Electronic', 'Jungle': 'Dance/Electronic', 'Acid House': 'Dance/Electronic',
  // Jazz
  'Hard Bop': 'Jazz', 'Bebop': 'Jazz', 'Cool Jazz': 'Jazz', 'Free Jazz': 'Jazz',
  'Modal': 'Jazz', 'Swing': 'Jazz', 'Big Band': 'Jazz', 'Fusion': 'Jazz', 'Post Bop': 'Jazz',
  'Contemporary Jazz': 'Jazz', 'Smooth Jazz': 'Jazz', 'Dixieland': 'Jazz', 'Ragtime': 'Jazz',
  // Soul / funk
  'Soul': 'R&B', 'Funk': 'R&B', 'Disco': 'R&B', 'Rhythm & Blues': 'R&B', 'Neo Soul': 'R&B',
  'Contemporary R&B': 'R&B', 'Gospel': 'Religious', 'Boogie': 'R&B', 'P.Funk': 'R&B',
  // Hip-hop
  'Hip Hop': 'Hip-Hop/Rap', 'Boom Bap': 'Hip-Hop/Rap', 'Gangsta': 'Hip-Hop/Rap',
  'Conscious': 'Hip-Hop/Rap', 'Trap': 'Hip-Hop/Rap',
  // Folk / country
  'Folk Rock': 'Folk', 'Country Rock': 'Country', 'Bluegrass': 'Folk', 'Honky Tonk': 'Country',
  'Americana': 'Folk', 'Singer/Songwriter': 'Folk', 'Acoustic': 'Folk',
  // Reggae
  'Roots Reggae': 'Reggae', 'Dub': 'Reggae', 'Ska': 'Reggae', 'Dancehall': 'Reggae', 'Rocksteady': 'Reggae',
  // Classical
  'Baroque': 'Classical', 'Romantic': 'Classical', 'Opera': 'Classical', 'Modern': 'Classical',
  'Neo-Classical': 'Classical', 'Contemporary': 'Classical', 'Renaissance': 'Medieval/Renaissance',
  // Latin / world
  'Bossa Nova': 'Latin', 'Samba': 'Latin', 'Salsa': 'Latin', 'Cumbia': 'Latin', 'Tango': 'Latin',
  'Afrobeat': 'World', 'Highlife': 'World', 'Celtic': 'World', 'Ethno-pop': 'World',
  'Chanson': 'Chanson Francaise', 'Chanson Française': 'Chanson Francaise',
  // Pop
  'Pop Rock': 'Pop', 'Europop': 'Pop', 'Ballad': 'Ballads/Romantic', 'Vocal': 'Pop',
  'Easy Listening': 'Ballads/Romantic', 'Schlager': 'Pop', 'J-pop': 'Pop', 'K-pop': 'Pop',
  'Blues Rock': 'Blues', 'Delta Blues': 'Blues', 'Chicago Blues': 'Blues', 'Electric Blues': 'Blues',
};

/**
 * Keyword fallbacks for styles not listed above, tried in order — the first
 * match wins, so the specific patterns come before the generic ones.
 */
const KEYWORD_RULES: Array<[RegExp, string]> = [
  [/hip.?hop|rap\b|trap/, 'Hip-Hop/Rap'],
  [/house|techno|trance|electro|ambient|garage house|drum ?n ?bass|dnb|idm|breakbeat|jungle|dubstep|edm|downtempo/, 'Dance/Electronic'],
  [/jazz|bop|swing|big band|ragtime|dixieland/, 'Jazz'],
  // `hardcore` sits here rather than with punk below: the -core styles are
  // heard as metal. Harmless for "Hardcore Techno", which the electronic
  // rule above already claims.
  [/metal|grindcore|thrash|doom|sludge|hardcore/, 'Metal'],
  [/reggae|\bdub\b|\bska\b|dancehall|rocksteady/, 'Reggae'],
  [/blues/, 'Blues'],
  [/soul|funk|disco|r ?& ?b|rnb|motown/, 'R&B'],
  [/gospel|worship|christian/, 'Religious'],
  [/country|honky|nashville|western/, 'Country'],
  [/folk|americana|bluegrass|songwriter|acoustic/, 'Folk'],
  [/classical|baroque|opera|symphon|chamber|choral/, 'Classical'],
  [/medieval|renaissance/, 'Medieval/Renaissance'],
  [/latin|salsa|cumbia|bossa|samba|tango|merengue|reggaeton|flamenco/, 'Latin'],
  [/chanson|varié?té/, 'Chanson Francaise'],
  [/afro|highlife|celtic|world|balkan|klezmer|raï|soukous/, 'World'],
  [/new age|meditat/, 'New Age'],
  [/shoegaze|indie|grunge|noise|post-rock|lo-fi|emo|math rock|krautrock/, 'Alternative'],
  [/punk|oi!/, 'Rock'],
  [/pop|synth|new wave|ye-ye/, 'Pop'],
  [/rock|prog|psych|surf|rockabilly/, 'Rock'],
];

/**
 * Ticketmaster's dumping grounds for events it never classified. They say
 * nothing about the music, so nothing may map onto them — one "Experimental"
 * record would otherwise pull in every unlabelled event in town.
 */
const UNUSABLE_GENRES = new Set(['Other', 'Undefined']);

/** The Ticketmaster genre a single Discogs style maps to, or null if none fits. */
function tmGenreForStyle(style: string): string | null {
  const exact = STYLE_TO_TM_GENRE[style];
  if (exact) return UNUSABLE_GENRES.has(exact) ? null : exact;

  const needle = style.toLowerCase();
  for (const [pattern, genre] of KEYWORD_RULES) {
    if (pattern.test(needle)) return genre;
  }
  return null;
}

/**
 * Ticketmaster genre → the user's own styles that led to it.
 *
 * Keeping the reverse mapping means a concert can explain *why* it was
 * suggested ("Hard Bop, Modal") rather than showing the coarse genre the user
 * never picked.
 */
export function discogsStylesToTmGenres(styles: string[]): Map<string, string[]> {
  const byGenre = new Map<string, string[]>();

  for (const style of styles) {
    const genre = tmGenreForStyle(style);
    if (!genre) continue;
    const existing = byGenre.get(genre);
    if (existing) existing.push(style);
    else byGenre.set(genre, [style]);
  }

  return byGenre;
}
