import { client } from './client';
import type { AdminTask, AdminTaskLog } from '../types/admin.types';

export async function getTasks(): Promise<AdminTask[]> {
    const { data } = await client.get<AdminTask[]>('/admin/tasks');
    return data;
}

export async function getTaskLogs(params: {
    limit: string;
    taskId?: string;
}): Promise<AdminTaskLog[]> {
    const { data } = await client.get<AdminTaskLog[]>('/admin/tasks/logs', { params });
    return data;
}

export interface TaskProgressEvent {
    type: 'progress';
    current: number;
    total: number;
    artist: string;
    title: string;
}

/** Fields vary per task, so everything past `type` is optional. */
export interface TaskCompleteEvent {
    type: 'complete';
    message?: string;
    forceRefresh?: boolean;
    synced?: number;
    syncedReleases?: number;
    syncedItems?: number;
    total?: number;
    totalReleases?: number;
    totalItems?: number;
    skipped?: number;
    skippedFresh?: number;
    skippedNoData?: number;
}

export interface TaskErrorEvent {
    type: 'error';
    message?: string;
}

export type TaskEvent = TaskProgressEvent | TaskCompleteEvent | TaskErrorEvent;

/**
 * Reads a `data:`-only SSE stream. Uses fetch rather than the axios client
 * because axios cannot expose a response body as a stream in the browser.
 *
 * Consuming this with `for await` and passing an AbortSignal guarantees the
 * reader is released when the caller unmounts.
 */
async function* streamEvents(
    url: string,
    init: RequestInit,
    signal?: AbortSignal
): AsyncGenerator<TaskEvent> {
    const response = await fetch(url, { ...init, credentials: 'include', signal });
    if (!response.ok || !response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    yield JSON.parse(line.slice(6)) as TaskEvent;
                } catch {
                    // Ignore malformed frames rather than killing the stream.
                }
            }
        }
    } finally {
        // Runs on early `break`/`return` by the consumer too, so an unmount
        // while a task is still running never leaves the reader dangling.
        reader.cancel().catch(() => {});
    }
}

export function runTask(taskId: string, signal?: AbortSignal): AsyncGenerator<TaskEvent> {
    return streamEvents(
        `/api/admin/tasks/${taskId}/run`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        signal
    );
}

export function subscribeTask(taskId: string, signal?: AbortSignal): AsyncGenerator<TaskEvent> {
    return streamEvents(`/api/admin/tasks/${taskId}/subscribe`, {}, signal);
}
