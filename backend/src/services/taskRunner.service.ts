import type { Response } from 'express';
import {
  getAdminTaskDefinition,
  recordAdminTaskExecution,
} from './adminTasks.service';
import type { TaskProgressEvent } from './adminTasks.service';

// ===== Types =====

interface RunningTaskState {
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  trigger: 'auto' | 'manual';
  startedAt: number;
  events: TaskProgressEvent[];
  subscribers: Set<Response>;
  result?: string;
  error?: string;
}

// ===== In-Memory State =====

const runningTasks = new Map<string, RunningTaskState>();

// ===== Public API =====

/**
 * Check if a task is currently running.
 */
export function isTaskRunning(taskId: string): boolean {
  return runningTasks.get(taskId)?.status === 'running';
}

/**
 * Get the current state of a task (or null if idle/never started).
 */
export function getRunningTaskState(taskId: string): RunningTaskState | null {
  return runningTasks.get(taskId) ?? null;
}

/**
 * Start a task in the background. Returns true if started, false if already running.
 * The task runs independently of any SSE subscriber.
 */
export function startTask(
  taskId: string,
  options: { forceRefresh?: boolean; trigger: 'auto' | 'manual' }
): boolean {
  // Prevent duplicate runs
  if (isTaskRunning(taskId)) {
    console.log(`[TaskRunner] Task "${taskId}" is already running. Skipping.`);
    return false;
  }

  const task = getAdminTaskDefinition(taskId);
  if (!task) {
    console.log(`[TaskRunner] Task "${taskId}" not found.`);
    return false;
  }

  const state: RunningTaskState = {
    taskId,
    status: 'running',
    trigger: options.trigger,
    startedAt: Date.now(),
    events: [],
    subscribers: new Set(),
  };
  runningTasks.set(taskId, state);

  console.log(`[TaskRunner] Starting "${taskId}" (trigger: ${options.trigger}, forceRefresh: ${options.forceRefresh ?? false})`);

  // Fire-and-forget background execution
  (async () => {
    try {
      const result = await task.runBackground(
        (event) => {
          state.events.push(event);
          // Broadcast to all SSE subscribers
          for (const res of state.subscribers) {
            try {
              res.write(`data: ${JSON.stringify(event)}\n\n`);
            } catch {
              state.subscribers.delete(res);
            }
          }
        },
        { forceRefresh: options.forceRefresh ?? false }
      );

      state.status = 'completed';
      state.result = result;
      console.log(`[TaskRunner] Task "${taskId}" completed: ${result}`);

      // Record execution
      try {
        await recordAdminTaskExecution({
          taskId,
          durationMs: Date.now() - state.startedAt,
          status: 'success',
          trigger: options.trigger,
          details: result,
        });
      } catch (recordError) {
        console.error(`[TaskRunner] Failed to record "${taskId}" success:`, recordError);
      }
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TaskRunner] Task "${taskId}" failed:`, state.error);

      // Notify subscribers of error
      const errorEvent: TaskProgressEvent = { type: 'error', message: state.error };
      state.events.push(errorEvent);
      for (const res of state.subscribers) {
        try {
          res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        } catch {
          state.subscribers.delete(res);
        }
      }

      // Record execution
      try {
        await recordAdminTaskExecution({
          taskId,
          durationMs: Date.now() - state.startedAt,
          status: 'failed',
          trigger: options.trigger,
          details: state.error,
        });
      } catch (recordError) {
        console.error(`[TaskRunner] Failed to record "${taskId}" failure:`, recordError);
      }
    } finally {
      // Close all subscriber connections
      for (const res of state.subscribers) {
        try {
          res.end();
        } catch { /* ignore */ }
      }
      state.subscribers.clear();

      // Clean up state after a short delay so the UI can still read the final result
      setTimeout(() => {
        const current = runningTasks.get(taskId);
        if (current === state) {
          runningTasks.delete(taskId);
        }
      }, 30_000);
    }
  })();

  return true;
}

/**
 * Subscribe an SSE response to a running task's progress stream.
 * Replays all buffered events, then streams new ones live.
 * Returns true if subscribed, false if no task is running.
 */
export function subscribeToTask(taskId: string, res: Response): boolean {
  const state = runningTasks.get(taskId);
  if (!state) return false;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Replay all buffered events
  for (const event of state.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // If already completed/failed, just end
  if (state.status !== 'running') {
    res.end();
    return true;
  }

  // Add to live subscribers
  state.subscribers.add(res);

  // Clean up on client disconnect
  res.on('close', () => {
    state.subscribers.delete(res);
  });

  return true;
}
