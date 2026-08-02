import CollectionItem from '../models/CollectionItem';
import AdminTaskExecution from '../models/AdminTaskExecution';
import type { IAlbum } from '../models/Album';
import { executePriceSync } from '../controllers/collection.controller';
import type { PopulatedCollectionItem } from '../controllers/collection.controller';
import { getPriceTTLHours } from '../utils/price.utils';
import ExchangeRates from '../models/ExchangeRates';
import UpcomingRelease from '../models/UpcomingRelease';
import { getAllDistinctStyles } from './collection.service';
import {
  fetchReleaseGroupsInWindow,
  fetchArtistTagsBatch,
  normalizeStyle,
  buildCoverArtUrl,
} from './musicbrainz.service';

// ===== Types =====

export interface AdminTaskSummary {
  id: string;
  intervalLabel: string;
  nextExecutionAt: string | null;
  lastExecutionAt: string | null;
  lastDurationMs: number | null;
  lastStatus: 'success' | 'failed' | null;
  isRunning: boolean;
}

export interface AdminTaskExecutionRecord {
  taskId: string;
  executedAt: Date;
  durationMs: number;
  status: 'success' | 'failed';
  trigger: 'auto' | 'manual';
  details?: string;
}

export interface TaskProgressEvent {
  type: string;
  [key: string]: unknown;
}

export interface AdminTaskDefinition {
  id: string;
  intervalMs: number;
  intervalLabel: string;
  getNextExecutionAt: (lastExecution: AdminTaskExecutionRecord | null) => Promise<Date | null> | Date | null;
  runBackground: (
    onProgress: (event: TaskProgressEvent) => void,
    options: { forceRefresh: boolean }
  ) => Promise<string>;
}

// ===== Helpers =====

/**
 * Advance a date forward by `intervalMs` until it is in the future.
 * Ensures the "Next Execution" date always shows an upcoming date.
 */
function rollForward(base: Date, intervalMs: number): Date {
  const now = Date.now();
  let ts = base.getTime();
  while (ts <= now) {
    ts += intervalMs;
  }
  return new Date(ts);
}

// ===== Task Definitions =====

const ADMIN_TASKS: AdminTaskDefinition[] = [
  {
    id: 'refresh-prices',
    get intervalMs() { return getPriceTTLHours() * 60 * 60 * 1000; },
    get intervalLabel() { return `${Math.round(getPriceTTLHours() / 24)} days`; },
    getNextExecutionAt: async (lastExecution) => {
      if (!lastExecution) return new Date();
      const intervalMs = getPriceTTLHours() * 60 * 60 * 1000;
      return rollForward(lastExecution.executedAt, intervalMs);
    },
    runBackground: async (onProgress, options) => {
      const allItems = await CollectionItem.find({})
        .populate<{ album: IAlbum }>('album');

      const result = await executePriceSync(
        allItems as unknown as PopulatedCollectionItem[],
        {
          forceRefresh: options.forceRefresh,
          logLabel: options.forceRefresh ? 'AdminPriceSync' : 'AutoPriceSync',
          onProgress: (event) => onProgress(event as TaskProgressEvent),
        }
      );

      onProgress({
        type: 'complete',
        synced: result.syncedReleases,
        syncedItems: result.syncedItems,
        skipped: result.skippedFresh + result.skippedNoData,
        total: result.totalReleases,
        totalItems: result.totalItems,
        totalValue: result.totalValue,
        currency: result.currency,
        forceRefresh: result.forceRefresh,
      });

      return options.forceRefresh
        ? `Refreshed ${result.syncedReleases} releases (${result.syncedItems} items).`
        : `Synced ${result.syncedReleases} releases (${result.syncedItems} items). ${result.skippedFresh} already fresh.`;
    },
  },
  {
    id: 'refresh-exchange-rates',
    intervalMs: 24 * 60 * 60 * 1000,
    get intervalLabel() { return '1 day'; },
    getNextExecutionAt: async (lastExecution) => {
      if (!lastExecution) return new Date();
      return rollForward(lastExecution.executedAt, 24 * 60 * 60 * 1000);
    },
    runBackground: async (onProgress) => {
      const fetchRes = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!fetchRes.ok) {
        throw new Error(`Failed to fetch exchange rates: ${fetchRes.statusText}`);
      }
      const data = await fetchRes.json() as { rates?: Record<string, number> };

      if (!data || !data.rates) {
        throw new Error('Invalid response structure from exchange rate API.');
      }

      const ratesMap = new Map<string, number>();
      for (const [currency, rate] of Object.entries(data.rates)) {
        ratesMap.set(currency, rate);
      }

      await ExchangeRates.findOneAndUpdate(
        { baseCurrency: 'USD' },
        { rates: ratesMap, lastUpdated: new Date() },
        { upsert: true, new: true }
      );

      onProgress({ type: 'complete' });

      return 'Fetched and updated daily exchange rates from open.er-api.com.';
    },
  },
  {
    id: 'refresh-upcoming-releases',
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    get intervalLabel() { return '7 days'; },
    getNextExecutionAt: async (lastExecution) => {
      if (!lastExecution) return new Date();
      return rollForward(lastExecution.executedAt, 7 * 24 * 60 * 60 * 1000);
    },
    runBackground: async (onProgress) => {
      const styles = await getAllDistinctStyles();
      if (styles.length === 0) {
        onProgress({ type: 'complete' });
        return 'No styles found across any collection — nothing to fetch.';
      }

      const now = new Date();
      const dateFrom = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const dateTo = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const releaseGroups = (
        await fetchReleaseGroupsInWindow(dateFrom, dateTo, (pass, maxPasses, current, total) =>
          onProgress({
            type: 'progress',
            current,
            total,
            label: `Release groups (pass ${pass}/${maxPasses})`,
          })
        )
      ).filter(
        (rg) =>
          rg.datePrecision !== 'year' &&
          (rg.primaryType === 'Album' || rg.primaryType === 'EP')
      );

      const uniqueArtistIds = Array.from(new Set(releaseGroups.flatMap((rg) => rg.artistIds)));

      const tagsByArtist = await fetchArtistTagsBatch(uniqueArtistIds, (current, total) =>
        onProgress({
          type: 'progress',
          current,
          total,
          label: `Artist tags (${uniqueArtistIds.length} artists)`,
        })
      );

      let matchedCount = 0;
      for (const rg of releaseGroups) {
        const artistTags = new Set<string>();
        for (const artistId of rg.artistIds) {
          for (const tag of tagsByArtist.get(artistId) || []) {
            artistTags.add(tag);
          }
        }
        if (artistTags.size === 0) continue;

        const matchedStyles = styles.filter((style) => artistTags.has(normalizeStyle(style)));
        if (matchedStyles.length === 0) continue;

        for (const style of matchedStyles) {
          await UpcomingRelease.findOneAndUpdate(
            { mbid: rg.mbid, style },
            {
              mbid: rg.mbid,
              title: rg.title,
              artist: rg.artist,
              style,
              firstReleaseDate: rg.firstReleaseDate,
              datePrecision: rg.datePrecision,
              primaryType: rg.primaryType,
              secondaryTypes: rg.secondaryTypes,
              coverArtUrl: buildCoverArtUrl(rg.mbid),
              fetchedAt: new Date(),
            },
            { upsert: true, new: true }
          );
          matchedCount++;
        }
      }

      // Clean up entries that fell out of the display window (dates before dateFrom).
      const staleResult = await UpcomingRelease.deleteMany({ firstReleaseDate: { $lt: dateFrom } });

      onProgress({ type: 'complete' });

      return `Matched ${matchedCount} (release, style) pairs from ${releaseGroups.length} release groups and ${uniqueArtistIds.length} artists. Removed ${staleResult.deletedCount} stale entries.`;
    },
  },
];

// ===== Public API =====

export function getAdminTaskDefinitions(): AdminTaskDefinition[] {
  return ADMIN_TASKS;
}

export function getAdminTaskDefinition(taskId: string): AdminTaskDefinition | undefined {
  return ADMIN_TASKS.find(task => task.id === taskId);
}

export async function listAdminTasks(isRunningFn?: (taskId: string) => boolean): Promise<AdminTaskSummary[]> {
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
        isRunning: isRunningFn ? isRunningFn(task.id) : false,
      };
    })
  );
}

export async function recordAdminTaskExecution(params: {
  taskId: string;
  durationMs: number;
  status: 'success' | 'failed';
  trigger: 'auto' | 'manual';
  details?: string;
}) {
  await AdminTaskExecution.create({
    taskId: params.taskId,
    durationMs: params.durationMs,
    status: params.status,
    trigger: params.trigger,
    details: params.details || '',
    executedAt: new Date(),
  });
}

export async function getAdminTaskLogs(limit: number = 50, taskId?: string) {
  const filter: Record<string, unknown> = {};
  if (taskId) {
    filter.taskId = taskId;
  }

  return AdminTaskExecution.find(filter)
    .sort({ executedAt: -1 })
    .limit(limit)
    .lean();
}
