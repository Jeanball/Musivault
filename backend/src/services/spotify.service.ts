/**
 * Spotify Web API import for the "add album" flow.
 *
 * The app only needs public album metadata: title, artist, release year,
 * tracklist and cover. Those are all available with the client-credentials
 * flow, so no user's Spotify account or redirect URI is involved.
 * https://developer.spotify.com/documentation/web-api/concepts/access-token
 */

import axios from 'axios';
import { logger } from '../config/logger.config';
import { downloadCoverToLocal } from '../utils/cover.utils';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
const REQUEST_TIMEOUT = 20_000;
/** Refresh a little early so a request never starts with an almost dead token. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
/** Spotify pages albums at 50 tracks; 20 pages is well beyond any real album. */
const MAX_TRACK_PAGES = 20;

export class InvalidSpotifyUrlError extends Error {
  constructor() {
    super('Enter a Spotify album link, e.g. https://open.spotify.com/album/...');
    this.name = 'InvalidSpotifyUrlError';
  }
}

export class MissingSpotifyCredentialsError extends Error {
  constructor() {
    super('Spotify import is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.');
    this.name = 'MissingSpotifyCredentialsError';
  }
}

export class SpotifyAlbumNotFoundError extends Error {
  constructor(id: string) {
    super(`Spotify album ${id} was not found`);
    this.name = 'SpotifyAlbumNotFoundError';
  }
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyImage {
  url: string;
  width?: number;
  height?: number;
}

interface SpotifyTrackItem {
  name: string;
  track_number: number;
  disc_number?: number;
  duration_ms: number;
  artists?: SpotifyArtist[];
}

interface SpotifyTracksPage {
  items: SpotifyTrackItem[];
  next: string | null;
  total: number;
}

interface SpotifyAlbumResponse {
  name: string;
  artists?: SpotifyArtist[];
  images?: SpotifyImage[];
  release_date?: string;
  external_urls?: { spotify?: string };
  tracks: SpotifyTracksPage;
}

export interface SpotifyImportTrack {
  position: string;
  title: string;
  duration: string;
  artist: string;
}

export interface SpotifyAlbumImport {
  title: string;
  artist: string;
  year: string;
  /** Local `/uploads/covers/...` path when the cover could be downloaded. */
  coverImage: string;
  tracklist: SpotifyImportTrack[];
  spotifyId: string;
  externalUrl: string;
}

let cachedToken: CachedToken | null = null;
let tokenRequest: Promise<string> | null = null;

/** Accepts localized web links, plain web links and the `spotify:album:` URI. */
export function parseSpotifyAlbumId(input: string): string {
  const value = typeof input === 'string' ? input.trim() : '';
  const match = value.match(
    /^(?:https?:\/\/(?:open\.)?spotify\.com\/(?:[a-z]{2,8}(?:-[a-z]{2,4})?\/)?album\/|spotify:album:)([A-Za-z0-9]{22})(?:[/?#].*)?$/i
  );
  if (!match) throw new InvalidSpotifyUrlError();
  return match[1];
}

export function isSpotifyConfigured(): boolean {
  return !!(process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim());
}

export function formatSpotifyDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '';
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new MissingSpotifyCredentialsError();

  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
    return cachedToken.value;
  }

  // Share one in-flight token request when several imports start together.
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const { data } = await axios.post<{ access_token: string; expires_in: number }>(
      TOKEN_URL,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: REQUEST_TIMEOUT
      }
    );

    if (!data?.access_token) throw new Error('Spotify did not return an access token');
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000
    };
    return data.access_token;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

async function fetchAlbum(spotifyId: string, token: string): Promise<SpotifyAlbumResponse> {
  const headers = { Authorization: `Bearer ${token}` };

  let album: SpotifyAlbumResponse;
  try {
    const response = await axios.get<SpotifyAlbumResponse>(
      `${API_BASE}/albums/${encodeURIComponent(spotifyId)}`,
      { headers, timeout: REQUEST_TIMEOUT }
    );
    album = response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new SpotifyAlbumNotFoundError(spotifyId);
    }
    throw error;
  }

  const items = [...(album.tracks?.items || [])];
  let next = album.tracks?.next || null;

  // `next` is an absolute URL returned by Spotify. Only follow it when it still
  // points at our API host, so a malformed response can never be used for SSRF.
  for (let page = 0; next && page < MAX_TRACK_PAGES; page += 1) {
    if (!next.startsWith(`${API_BASE}/`)) {
      logger.warn({ next }, '[Spotify] Refusing a track page outside the Spotify API');
      break;
    }
    const response = await axios.get<SpotifyTracksPage>(next, { headers, timeout: REQUEST_TIMEOUT });
    items.push(...(response.data?.items || []));
    next = response.data?.next || null;
  }

  return { ...album, tracks: { ...album.tracks, items, next: null } };
}

/** Pure mapping, kept separate so the shape can be tested without HTTP. */
export function normalizeSpotifyAlbum(
  album: SpotifyAlbumResponse,
  spotifyId: string,
  inputUrl: string,
  coverImage: string
): SpotifyAlbumImport {
  const artist = (album.artists || []).map(a => a.name).filter(Boolean).join(', ');

  const tracklist: SpotifyImportTrack[] = (album.tracks?.items || []).map((track, index) => {
    const trackArtists = (track.artists || []).map(a => a.name).filter(Boolean).join(', ');
    const disc = track.disc_number || 1;
    return {
      position: disc > 1 ? `${disc}-${track.track_number}` : String(track.track_number || index + 1),
      title: track.name || '',
      duration: formatSpotifyDuration(track.duration_ms),
      // A track by the album's own artist leaves the optional artist column free.
      artist: trackArtists.toLowerCase() === artist.toLowerCase() ? '' : trackArtists
    };
  });

  return {
    title: album.name || '',
    artist,
    year: /^\d{4}/.exec(album.release_date || '')?.[0] || '',
    coverImage,
    tracklist,
    spotifyId,
    externalUrl: album.external_urls?.spotify || inputUrl
  };
}

/** Fetch and normalize an album from a pasted Spotify URL or URI. */
export async function importSpotifyAlbum(input: string): Promise<SpotifyAlbumImport> {
  const spotifyId = parseSpotifyAlbumId(input);
  const token = await getAccessToken();
  const album = await fetchAlbum(spotifyId, token);

  const remoteCover = [...(album.images || [])].sort(
    (a, b) => (b.width || 0) - (a.width || 0)
  )[0]?.url;
  const coverImage = remoteCover ? await downloadCoverToLocal(remoteCover, 'Spotify cover') : '';

  return normalizeSpotifyAlbum(album, spotifyId, input, coverImage);
}
