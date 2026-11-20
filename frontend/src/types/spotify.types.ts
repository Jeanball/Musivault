/** Normalized album payload returned by `GET /api/spotify/album`. */

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
    /** Local `/uploads/covers/...` path, or an empty string when unavailable. */
    coverImage: string;
    tracklist: SpotifyImportTrack[];
    spotifyId: string;
    externalUrl: string;
}
