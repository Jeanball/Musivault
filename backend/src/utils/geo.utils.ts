/**
 * Geo helpers for the "record shops near you" discover feature.
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
 * Overpass is queried per tile rather than per user position: it shares one
 * cache entry between nearby users, and it means the user's exact coordinates
 * never leave this server. 0.1 degree is roughly 11 km of latitude.
 */
export const TILE_SIZE_DEGREES = 0.1;

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
