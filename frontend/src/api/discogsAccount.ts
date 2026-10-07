import { client } from './client';
import type { DiscogsAccountStatus } from '../types/discogsAccount.types';

/** Connection status. Also re-checks a connected token with Discogs, so it can be slow. */
export async function getDiscogsAccount(): Promise<DiscogsAccountStatus> {
    const { data } = await client.get<DiscogsAccountStatus>('/discogs-account');
    return data;
}

/** Connect with the server's account (admins) or with the user's own personal token. */
export async function connectDiscogsAccount(
    body: { source: 'server' } | { source: 'own'; token: string }
): Promise<void> {
    await client.put('/discogs-account', body);
}

export async function disconnectDiscogsAccount(): Promise<void> {
    await client.delete('/discogs-account');
}
