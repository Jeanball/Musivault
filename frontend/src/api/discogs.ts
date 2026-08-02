import { client } from './client';
import type { DiscogsResult, ArtistResult, ArtistPageData, LabelInfo } from '../types/discogs.types';
import type { AlbumDetails } from '../types/album.types';

export type LookupType = 'discogsId' | 'catno';

/** The search bar always needs both lists, so they are fetched together. */
export async function searchAll(
    query: string,
    signal?: AbortSignal
): Promise<{ albums: DiscogsResult[]; artists: ArtistResult[] }> {
    const [albums, artists] = await Promise.all([
        client.get<DiscogsResult[]>('/discogs/search', { params: { q: query }, signal }),
        client.get<ArtistResult[]>('/discogs/search/artists', { params: { q: query }, signal })
    ]);
    return {
        albums: Array.isArray(albums.data) ? albums.data : [],
        artists: Array.isArray(artists.data) ? artists.data : []
    };
}

export async function searchByBarcode(barcode: string): Promise<DiscogsResult[]> {
    const { data } = await client.get<DiscogsResult[]>('/discogs/search/barcode', {
        params: { barcode }
    });
    return data;
}

export async function lookup(ref: string, type: LookupType): Promise<DiscogsResult[]> {
    const { data } = await client.get<DiscogsResult[]>('/discogs/lookup', {
        params: { ref, type }
    });
    return data;
}

export async function getRelease(releaseId: number | string): Promise<AlbumDetails> {
    const { data } = await client.get<AlbumDetails>(`/discogs/release/${releaseId}`);
    return data;
}

/** Resolve a label by Discogs id, or by name for albums saved before ids were stored. */
export async function getLabelInfo(params: { id?: number; name?: string }): Promise<LabelInfo> {
    const { data } = await client.get<LabelInfo>('/discogs/label', {
        params: params.id ? { id: params.id } : { name: params.name }
    });
    return data;
}

export async function getArtistReleases(
    artistId: string,
    params: { sort: string; order: string }
): Promise<ArtistPageData> {
    const { data } = await client.get<ArtistPageData>(`/discogs/artist/${artistId}/releases`, {
        params
    });
    return data;
}

export async function getMasterVersions<T>(masterId: string): Promise<T> {
    const { data } = await client.get<T>(`/discogs/master/${masterId}/versions`);
    return data;
}
