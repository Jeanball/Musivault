import { client } from './client';
import type { CollectionItem } from '../types/collection.types';
import type { CustomFieldValues } from '../types/customFields.types';
import type { FormatDetails } from '../types/album.types';
import type { ImportLog, ImportStarted } from '../types/import.types';

export interface CollectionSyncInfo {
    nextAutoSyncAt: string | null;
    lastSyncedAt: string | null;
    ttlHours: number;
}

export async function getCollection(
    sort?: 'latest',
    limit?: number
): Promise<CollectionItem[]> {
    const { data } = await client.get<CollectionItem[]>('/collection', {
        params: { ...(sort ? { sort } : {}), ...(limit ? { limit } : {}) }
    });
    return data;
}

export async function getCollectionItem(itemId: string): Promise<CollectionItem> {
    const { data } = await client.get<CollectionItem>(`/collection/${itemId}`);
    return data;
}

export async function getSyncInfo(): Promise<CollectionSyncInfo> {
    const { data } = await client.get<CollectionSyncInfo>('/collection/sync-info');
    return data;
}

/** Adds a Discogs release; the payload is the release details plus a format. */
export async function addToCollection(
    payload: Record<string, unknown>
): Promise<{ item: CollectionItem }> {
    const { data } = await client.post<{ item: CollectionItem }>('/collection', payload);
    return data;
}

export async function updateCollectionItem(
    itemId: string,
    patch: Partial<{
        mediaCondition: string | null;
        sleeveCondition: string | null;
        customFields: CustomFieldValues;
    }>
): Promise<CollectionItem> {
    const { data } = await client.put<CollectionItem>(`/collection/${itemId}`, patch);
    return data;
}

export async function removeFromCollection(itemId: string): Promise<void> {
    await client.delete(`/collection/${itemId}`);
}

export async function syncItemPrice(itemId: string): Promise<CollectionItem> {
    const { data } = await client.post<CollectionItem>(`/collection/${itemId}/sync-price`, {});
    return data;
}

export async function rematchAlbum(
    itemId: string,
    payload: { newDiscogsId: number; format: FormatDetails }
): Promise<void> {
    await client.post(`/collection/${itemId}/rematch`, payload);
}

export async function ignoreFormatAlert(itemId: string): Promise<CollectionItem> {
    const { data } = await client.post<CollectionItem>(`/collection/${itemId}/ignore-format-alert`, {});
    return data;
}

export async function restoreFormatAlert(itemId: string): Promise<CollectionItem> {
    const { data } = await client.post<CollectionItem>(`/collection/${itemId}/restore-format-alert`, {});
    return data;
}

/**
 * Manual album entry. Content-Type is deliberately left unset: axios derives
 * multipart/form-data and appends the boundary itself for a FormData body.
 */
export async function addManualAlbum(form: FormData): Promise<void> {
    await client.post('/collection/manual', form);
}

export async function startCsvImport(file: File): Promise<ImportStarted> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await client.post<ImportStarted>('/collection/import', form);
    return data;
}

/** Blank CSV template with the columns the importer understands. */
export async function downloadCsvTemplate(): Promise<Blob> {
    const { data } = await client.get<Blob>('/collection/template', {
        responseType: 'blob'
    });
    return data;
}

/** CSV backup of the whole collection, ready to be saved as a file. */
export async function exportCollection(): Promise<Blob> {
    const { data } = await client.get<Blob>('/collection/export', {
        responseType: 'blob'
    });
    return data;
}

export async function getImportLog(logId: string): Promise<ImportLog> {
    const { data } = await client.get<ImportLog>(`/collection/import/logs/${logId}`);
    return data;
}

export async function downloadImportLog(logId: string): Promise<Blob> {
    const { data } = await client.get<Blob>(`/collection/import/logs/${logId}/download`, {
        responseType: 'blob'
    });
    return data;
}

/** Distinct styles across the user's collection, sorted alphabetically. */
export async function getCollectionStyles(): Promise<string[]> {
    const { data } = await client.get<string[]>('/collection/styles');
    return data;
}
