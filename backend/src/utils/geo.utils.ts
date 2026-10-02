/**
 * Geo helpers shared by the "near you" discover features (record shops, concerts).
 */

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Upstreams are queried per tile rather than per user position: it shares one
 * cache entry between nearby users, and it means the user's exact coordinates
 * never leave this server. 0.1 degree is roughly 11 km of latitude.
 */
export const TILE_SIZE_DEGREES = 0.1;

/**
 * Results are fetched at one of two radii, then the user's own radius filters
 * them — so moving the slider within a band never refetches. Two bands rather
 * than one because a 500 km query is dramatically more expensive, and making
 * everyone pay it just so the rare wide search is instant is a bad trade. Each
 * includes 10 km of slack for the ~7.9 km a user can sit from their tile
 * centre, which would otherwise clip results at the top of the band.
 */
export const RADIUS_BANDS_KM = [110, 310] as const;

/**
 * Bounds of the radius slider, shared by every "near you" section.
 *
 * 300 km rather than something larger because Ticketmaster refuses to page past
 * its 1000th result: a wider search would return a fraction of what exists and
 * present it as the whole list. Offering a radius we cannot answer honestly is
 * worse than not offering it.
 */
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 300;

/** Smallest band that fully covers the requested radius. */
export function bandFor(radiusKm: number): number {
  return RADIUS_BANDS_KM.find((band) => radiusKm + 10 <= band) ?? RADIUS_BANDS_KM[RADIUS_BANDS_KM.length - 1];
}

export interface Tile {
  key: string;
  lat: number;
  lon: number;
}

/** Snaps a position to the centre of its tile. */
export function roundToTile(lat: number, lon: number): Tile {
  const tileLat = Math.round(lat / TILE_SIZE_DEGREES) * TILE_SIZE_DEGREES;
  const tileLon = Math.round(lon / TILE_SIZE_DEGREES) * TILE_SIZE_DEGREES;
  // Fixed precision keeps the key stable despite float rounding (e.g. 48.900000000000006).
  const key = `${tileLat.toFixed(1)},${tileLon.toFixed(1)}`;
  return { key, lat: Number(tileLat.toFixed(1)), lon: Number(tileLon.toFixed(1)) };
}

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode a position as a geohash. Ticketmaster's `geoPoint` filter takes one of
 * these; its `latlong` equivalent is deprecated. Precision 6 is a ~1.2 km cell,
 * finer than our tiles, so it costs nothing in accuracy.
 */
export function geohashEncode(lat: number, lon: number, precision = 6): string {
  let latRange = [-90, 90];
  let lonRange = [-180, 180];
  let hash = '';
  let bits = 0;
  let bitCount = 0;
  // Geohash interleaves longitude and latitude bits, starting with longitude:
  // each bit halves the corresponding range, and every five bits become one
  // base32 character.
  let isLon = true;

  while (hash.length < precision) {
    const range = isLon ? lonRange : latRange;
    const middle = (range[0] + range[1]) / 2;
    const value = isLon ? lon : lat;

    if (value > middle) {
      bits = (bits << 1) + 1;
      range[0] = middle;
    } else {
      bits = bits << 1;
      range[1] = middle;
    }
    if (isLon) lonRange = range; else latRange = range;

    isLon = !isLon;
    if (++bitCount === 5) {
      hash += GEOHASH_BASE32[bits];
      bits = 0;
      bitCount = 0;
    }
  }

  return hash;
}

/**
 * Private, loopback and link-local addresses. IP geolocation on these returns
 * either an error or the datacentre's own location, so they are not worth a
 * lookup — common in dev, and behind a reverse proxy without trust proxy set.
 */
export function isPrivateIp(ip?: string | null): boolean {
  if (!ip) return true;

  // Express may hand back an IPv4-mapped IPv6 address.
  const address = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  if (address === '::1' || address === 'localhost') return true;
  if (address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80')) return true;

  const parts = address.split('.');
  if (parts.length !== 4) return false;

  const [a, b] = parts.map(Number);
  if ([a, b].some(isNaN)) return true;

  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;

  return false;
}
