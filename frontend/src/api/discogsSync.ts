import { client } from './client';
import type { DiscogsApplySelection, DiscogsPendingSummary, DiscogsSyncReport } from '../types/discogsAccount.types';

/** Start a read-only check of the Discogs collection against Musivault. It runs in the background. */
export async function startDiscogsCheck(): Promise<void> {
    await client.post('/discogs-sync/check');
}

/** The latest check: progress while it runs, the full result when done. `null` before the first one. */
export async function getDiscogsReport(): Promise<DiscogsSyncReport | null> {
    const { data } = await client.get<{ report: DiscogsSyncReport | null }>('/discogs-sync/report');
    return data.report;
}

/**
 * Apply the rows the user ticked, in the background (poll `getDiscogsReport` and read `apply`).
 * Rejects with a 409 when another Discogs job is running or the token needs reconnecting.
 */
export async function applyDiscogsSelection(selection: DiscogsApplySelection): Promise<void> {
    await client.post('/discogs-sync/apply', selection);
}

/** What the last check left to act on, or `null` when sync is off or nothing was checked yet. */
export async function getDiscogsSummary(): Promise<DiscogsPendingSummary | null> {
    const { data } = await client.get<{ summary: DiscogsPendingSummary | null }>('/discogs-sync/summary');
    return data.summary;
}

/** Ask the running apply to stop after the record it is on. Rejects with a 409 when none is running. */
export async function stopDiscogsApply(): Promise<void> {
    await client.post('/discogs-sync/apply/stop');
}
