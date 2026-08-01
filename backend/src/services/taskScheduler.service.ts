import AdminTaskExecution from '../models/AdminTaskExecution';
import { getAdminTaskDefinitions } from './adminTasks.service';
import { isTaskRunning, startTask } from './taskRunner.service';
import { isBackgroundMigrationRunning } from '../scripts/migration-runner';
import { logger } from '../config/logger.config';

const SCHEDULER_INTERVAL_MS = 60_000; // Check every 60 seconds

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check all registered tasks and run any that are due.
 * A task is due if it has never been run, or if lastExecution + intervalMs <= now.
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

      const lastExecution = await AdminTaskExecution.findOne({
        taskId: task.id,
        status: 'success',
      })
        .sort({ executedAt: -1 })
        .lean();

      const isDue = !lastExecution ||
        (Date.now() - new Date(lastExecution.executedAt).getTime() >= task.intervalMs);

      if (isDue) {
        logger.info(
          `[Scheduler] Task "${task.id}" is due.` +
          (lastExecution
            ? ` Last run: ${new Date(lastExecution.executedAt).toISOString()}`
            : ' Never run before.')
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
