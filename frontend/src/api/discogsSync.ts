import { client } from './client';
import type { DiscogsSyncReport } from '../types/discogsAccount.types';

/** Start a read-only check of the Discogs collection against Musivault. It runs in the background. */
export async function startDiscogsCheck(): Promise<void> {
    await client.post('/discogs-sync/check');
}

/** The latest check: progress while it runs, the full result when done. `null` before the first one. */
export async function getDiscogsReport(): Promise<DiscogsSyncReport | null> {
    const { data } = await client.get<{ report: DiscogsSyncReport | null }>('/discogs-sync/report');
    return data.report;
}
