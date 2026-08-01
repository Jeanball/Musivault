import AdminTaskExecution from '../models/AdminTaskExecution';
import { getAdminTaskDefinitions } from './adminTasks.service';
import { isTaskRunning, startTask } from './taskRunner.service';
import { isBackgroundMigrationRunning } from '../scripts/migration-runner';
import { logger } from '../config/logger.config';

const SCHEDULER_INTERVAL_MS = 60_000; // Check every 60 seconds

/** Wait after a first failure before retrying, doubling on each further failure. */
const RETRY_BASE_DELAY_MS = 5 * 60_000;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * How long to wait after a failed run before retrying.
 *
 * Exponential from RETRY_BASE_DELAY_MS, never longer than the task's own
 * interval — a weekly task retries within hours, not next week.
 */
function retryDelayMs(consecutiveFailures: number, intervalMs: number): number {
  const backoff = RETRY_BASE_DELAY_MS * 2 ** (consecutiveFailures - 1);
  return Math.min(backoff, intervalMs);
}

/**
 * Check all registered tasks and run any that are due.
 *
 * Due-ness is computed from the most recent execution whatever its status. Only
 * looking at successes would leave a task that always fails permanently due, so
 * the scheduler would restart it on every tick; failures instead get an
 * exponential backoff.
 */
async function checkAndRunDueTasks() {
  if (isBackgroundMigrationRunning()) {
    logger.info('[Scheduler] Paused: Background migrations are currently running.');
    return;
  }

  const tasks = getAdminTaskDefinitions();

  for (const task of tasks) {
    try {
      if (isTaskRunning(task.id)) {
        continue;
      }

      const lastExecution = await AdminTaskExecution.findOne({ taskId: task.id })
        .sort({ executedAt: -1 })
        .lean();

      if (!lastExecution) {
        logger.info(`[Scheduler] Task "${task.id}" is due. Never run before.`);
        startTask(task.id, { forceRefresh: false, trigger: 'auto' });
        continue;
      }

      const elapsedMs = Date.now() - new Date(lastExecution.executedAt).getTime();
      const lastRunAt = new Date(lastExecution.executedAt).toISOString();

      if (lastExecution.status === 'success') {
        if (elapsedMs >= task.intervalMs) {
          logger.info(`[Scheduler] Task "${task.id}" is due. Last run: ${lastRunAt}`);
          startTask(task.id, { forceRefresh: false, trigger: 'auto' });
        }
        continue;
      }

      // Failed last time: back off based on how many failures we've piled up
      // since the last success.
      const lastSuccess = await AdminTaskExecution.findOne({
        taskId: task.id,
        status: 'success',
      })
        .sort({ executedAt: -1 })
        .lean();

      const consecutiveFailures = await AdminTaskExecution.countDocuments({
        taskId: task.id,
        status: 'failed',
        ...(lastSuccess ? { executedAt: { $gt: lastSuccess.executedAt } } : {}),
      });

      const waitMs = retryDelayMs(consecutiveFailures, task.intervalMs);

      if (elapsedMs >= waitMs) {
        logger.info(
          `[Scheduler] Retrying failed task "${task.id}" ` +
          `(${consecutiveFailures} consecutive failure(s), last attempt: ${lastRunAt})`
        );
        startTask(task.id, { forceRefresh: false, trigger: 'auto' });
      }
    } catch (error) {
      logger.error({ err: error }, `[Scheduler] Error checking task "${task.id}"`);
    }
  }
}

/**
 * Start the background task scheduler.
 * Runs a check immediately on startup, then repeats every 60 seconds.
 */
export function startTaskScheduler() {
  if (schedulerInterval) {
    logger.warn('[Scheduler] Scheduler is already running.');
    return;
  }

  logger.info('[Scheduler] Starting task scheduler (interval: 60s)');

  // Initial check after a short delay to let the server fully boot
  setTimeout(() => {
    checkAndRunDueTasks();
  }, 5_000);

  // Periodic check
  schedulerInterval = setInterval(() => {
    checkAndRunDueTasks();
  }, SCHEDULER_INTERVAL_MS);
}

/**
 * Stop the scheduler (for testing/graceful shutdown).
 */
export function stopTaskScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[Scheduler] Scheduler stopped.');
  }
}
