import { client } from './client';
import type { PublicUser, PublicCollection } from '../types/public.types';

// These two endpoints are the only ones served without authentication.

export async function getPublicUsers(): Promise<PublicUser[]> {
    const { data } = await client.get<PublicUser[]>('/public/users');
    return data;
}

export async function getSharedCollection(shareId: string): Promise<PublicCollection> {
    const { data } = await client.get<PublicCollection>(`/public/${shareId}`);
    return data;
}
