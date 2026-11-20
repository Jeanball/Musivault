import { client } from './client';
import type { SpotifyAlbumImport } from '../types/spotify.types';

/**
 * Read an album's public metadata from a pasted Spotify link. The backend owns
 * the Spotify credentials; this call never exposes them to the browser.
 */
export async function getSpotifyAlbum(url: string): Promise<SpotifyAlbumImport> {
    const { data } = await client.get<SpotifyAlbumImport>('/spotify/album', {
        params: { url }
    });
    return data;
}
