/**
 * Collection value history.
 *
 * priceCache is a cache: it is overwritten in place on every sync, so nothing
 * records what a collection was worth last month. These snapshots are that
 * record. One row per user per day at most, written by the price sync task and
 * refreshed for the current day whenever the chart is read.
 *
 * Mutations deliberately write nothing. A snapshot is a closing value, not an
 * event log, and scattering writes across add/delete/rematch/sync would give a
 * series with three points on some days and none on others.
 */

import mongoose from 'mongoose';
import CollectionItem from '../models/CollectionItem';
import type { IPriceCache } from '../models/CollectionItem';
import ValueSnapshot from '../models/ValueSnapshot';
import { logger } from '../config/logger.config';

/**
 * The two fields a value depends on, and nothing else: this accepts a hydrated
 * document, a lean result or a projection alike.
 */
export interface PricedItem {
  priceCache?: IPriceCache | null;
  mediaCondition?: string | null;
}

/**
 * The effective value of an item: its price for the condition it is in.
 * Mirrors getItemValue on the frontend; both must agree or the chart and the
 * total value KPI show different numbers for the same collection.
 */
export function getValueForItem(item: PricedItem): number {
  if (!item.priceCache) return 0;
  const pc = item.priceCache;

  switch (item.mediaCondition) {
    case 'M': return pc.mint ?? pc.nearMint ?? 0;
    case 'NM': return pc.nearMint ?? pc.mint ?? 0;
    case 'VG+': return pc.veryGoodPlus ?? 0;
    case 'VG': return pc.veryGood ?? 0;
    case 'G+': return pc.goodPlus ?? 0;
    case 'G': return pc.good ?? 0;
    case 'F': return pc.fair ?? 0;
    case 'P': return pc.poor ?? 0;
    default: return pc.veryGoodPlus ?? pc.nearMint ?? 0; // default to VG+
  }
}

/** Local calendar day, 'YYYY-MM-DD'. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface CollectionTotal {
  totalValue: number;
  itemCount: number;
}

/** Sum a user's priced items. Rounded once, at the total, like the frontend. */
export async function computeCollectionTotal(
  userId: mongoose.Types.ObjectId | string
): Promise<CollectionTotal> {
  const items = await CollectionItem.find({ user: userId }).select('priceCache mediaCondition').lean();

  let totalValue = 0;
  let itemCount = 0;
  for (const item of items) {
    const value = getValueForItem(item);
    if (value > 0) {
      totalValue += value;
      itemCount++;
    }
  }

  return { totalValue: Math.round(totalValue * 100) / 100, itemCount };
}

/**
 * Record today's value for a user, unless it is unchanged.
 *
 * Skipping identical values keeps the table sparse: a quiet week leaves one row
 * instead of seven, and the curve is identical either way since a line between
 * two points is drawn straight. It also makes reads idempotent, so opening the
 * stats page thirty times writes nothing.
 */
export async function recordValueSnapshot(userId: mongoose.Types.ObjectId | string): Promise<void> {
  const { totalValue, itemCount } = await computeCollectionTotal(userId);

  const latest = await ValueSnapshot.findOne({ user: userId }).sort({ day: -1 }).lean();
  if (latest && latest.totalValue === totalValue && latest.itemCount === itemCount) {
    return;
  }

  await ValueSnapshot.findOneAndUpdate(
    { user: userId, day: toDayKey(new Date()) },
    { $set: { totalValue, itemCount, capturedAt: new Date() } },
    { upsert: true }
  );
}

/** Snapshot every user who owns items. Used by the price sync task. */
export async function recordAllUserSnapshots(): Promise<number> {
  const userIds = await CollectionItem.distinct('user');

  let recorded = 0;
  for (const userId of userIds) {
    try {
      await recordValueSnapshot(userId);
      recorded++;
    } catch (err) {
      logger.error({ err }, `[ValueSnapshot] Failed to record snapshot for user ${userId}`);
    }
  }

  return recorded;
}

export interface ValuePoint {
  date: string;
  value: number;
  itemCount: number;
}

export async function getValueHistory(
  userId: mongoose.Types.ObjectId | string
): Promise<ValuePoint[]> {
  const snapshots = await ValueSnapshot.find({ user: userId }).sort({ day: 1 }).lean();

  return snapshots.map(snapshot => ({
    date: snapshot.day,
    value: snapshot.totalValue,
    itemCount: snapshot.itemCount,
  }));
}

/** Whether a snapshot was written by the history rebuild (stamped at local midnight) rather than measured. */
function isSeeded(snapshot: { day: string; capturedAt: Date }): boolean {
  return snapshot.capturedAt.getTime() === new Date(`${snapshot.day}T00:00:00`).getTime();
}

/**
 * Rebuild a user's value history from their items' `addedAt`, the way the browser used to derive it:
 * each item's current price counted from the day it was added, accumulated day by day.
 * Used by the `2026-08-09_backfill-value-snapshots` migration and after the Discogs sync changes dates.
 *
 * By default it only writes (or overwrites) the days the curve covers. With `replaceSeeded`, the rows
 * an earlier rebuild wrote are removed first, so days that no longer carry items disappear, while rows
 * measured by the price sync are kept and win over the curve on their day.
 * Returns the number of snapshots written.
 */
export async function rebuildValueHistory(
  userId: mongoose.Types.ObjectId | string,
  { replaceSeeded = false }: { replaceSeeded?: boolean } = {}
): Promise<number> {
  const items = await CollectionItem.find({ user: userId })
    .select('priceCache mediaCondition addedAt')
    .sort({ addedAt: 1 })
    .lean();

  const measuredDays = new Set<string>();
  if (replaceSeeded) {
    const existing = await ValueSnapshot.find({ user: userId }).select('day capturedAt').lean();
    const seeded = existing.filter(isSeeded);
    existing.filter(s => !isSeeded(s)).forEach(s => measuredDays.add(s.day));
    await ValueSnapshot.deleteMany({ _id: { $in: seeded.map(s => s._id) } });
  }

  // Sum per day first, then walk the days in order to accumulate.
  const dailyValue = new Map<string, number>();
  const dailyCount = new Map<string, number>();

  for (const item of items) {
    const value = getValueForItem(item);
    if (value <= 0) continue;

    const day = toDayKey(new Date(item.addedAt));
    dailyValue.set(day, (dailyValue.get(day) || 0) + value);
    dailyCount.set(day, (dailyCount.get(day) || 0) + 1);
  }

  let cumulativeValue = 0;
  let cumulativeCount = 0;
  let written = 0;

  for (const day of [...dailyValue.keys()].sort()) {
    cumulativeValue += dailyValue.get(day)!;
    cumulativeCount += dailyCount.get(day)!;
    if (measuredDays.has(day)) continue;

    await ValueSnapshot.findOneAndUpdate(
      { user: userId, day },
      {
        $set: {
          totalValue: Math.round(cumulativeValue * 100) / 100,
          itemCount: cumulativeCount,
          capturedAt: new Date(`${day}T00:00:00`),
        }
      },
      { upsert: true }
    );
    written++;
  }

  return written;
}
