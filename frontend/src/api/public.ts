import { client } from './client';
import type { PublicUser, PublicCollection, CommunityAlbum } from '../types/public.types';

// These endpoints are the only ones served without authentication.

export async function getPublicUsers(): Promise<PublicUser[]> {
    const { data } = await client.get<PublicUser[]>('/public/users');
    return data;
}

/** The most recent additions across every public collection on the instance. */
export async function getLatestPublicAlbums(limit?: number): Promise<CommunityAlbum[]> {
    const { data } = await client.get<CommunityAlbum[]>('/public/albums/latest', {
        params: limit ? { limit } : undefined,
    });
    return data;
}

export async function getSharedCollection(shareId: string): Promise<PublicCollection> {
    const { data } = await client.get<PublicCollection>(`/public/${shareId}`);
    return data;
}
