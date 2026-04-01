import type { Response } from 'express';
import CollectionItem from '../models/CollectionItem';
import AdminTaskExecution from '../models/AdminTaskExecution';
import type { IAlbum } from '../models/Album';
import { streamPriceSync } from '../controllers/collection.controller';
import type { PopulatedCollectionItem } from '../controllers/collection.controller';
import { getPriceTTLHours } from '../utils/price.utils';

export interface AdminTaskSummary {
  id: string;
  intervalLabel: string;
  nextExecutionAt: string | null;
  lastExecutionAt: string | null;
  lastDurationMs: number | null;
  lastStatus: 'success' | 'failed' | null;
}

interface AdminTaskExecutionRecord {
  taskId: string;
  executedAt: Date;
  durationMs: number;
  status: 'success' | 'failed';
  details?: string;
}

interface AdminTaskDefinition {
  id: string;
  intervalLabel: string;
  getNextExecutionAt: (lastExecution: AdminTaskExecutionRecord | null) => Promise<Date | null> | Date | null;
  run: (res: Response) => Promise<string>;
}

const ADMIN_TASKS: AdminTaskDefinition[] = [
  {
    id: 'refresh-prices',
    get intervalLabel() { return `${Math.round(getPriceTTLHours() / 24)} days`; },
    getNextExecutionAt: (lastExecution) => {
      if (!lastExecution) return null;
      return new Date(lastExecution.executedAt.getTime() + getPriceTTLHours() * 60 * 60 * 1000);
    },
    run: async (res: Response) => {
      const allItems = await CollectionItem.find({})
        .populate<{ album: IAlbum }>('album');

      const finished = await streamPriceSync(res, allItems as unknown as PopulatedCollectionItem[], {
        forceRefresh: true,
        logLabel: 'AdminPriceSync',
      });

      if (!finished) {
        throw new Error('Task was cancelled by the user.');
      }

      return 'Refreshed cached prices across all collections.';
    },
  },
];

export function getAdminTaskDefinition(taskId: string): AdminTaskDefinition | undefined {
  return ADMIN_TASKS.find(task => task.id === taskId);
}

export async function listAdminTasks(): Promise<AdminTaskSummary[]> {
  const taskIds = ADMIN_TASKS.map(task => task.id);
  const executions = await AdminTaskExecution.find({ taskId: { $in: taskIds } })
    .sort({ executedAt: -1 })
    .lean<AdminTaskExecutionRecord[]>();

  const latestExecutionByTask = new Map<string, AdminTaskExecutionRecord>();
  for (const execution of executions) {
    if (!latestExecutionByTask.has(execution.taskId)) {
      latestExecutionByTask.set(execution.taskId, execution);
    }
  }

  return Promise.all(
    ADMIN_TASKS.map(async (task) => {
      const lastExecution = latestExecutionByTask.get(task.id) || null;
      const nextExecutionAt = await task.getNextExecutionAt(lastExecution);

      return {
        id: task.id,
        intervalLabel: task.intervalLabel,
        nextExecutionAt: nextExecutionAt?.toISOString() ?? null,
        lastExecutionAt: lastExecution?.executedAt?.toISOString?.() ?? null,
        lastDurationMs: lastExecution?.durationMs ?? null,
        lastStatus: lastExecution?.status ?? null,
      };
    })
  );
}

export async function recordAdminTaskExecution(params: {
  taskId: string;
  durationMs: number;
  status: 'success' | 'failed';
  details?: string;
}) {
  await AdminTaskExecution.create({
    taskId: params.taskId,
    durationMs: params.durationMs,
    status: params.status,
    details: params.details || '',
    executedAt: new Date(),
  });
}
