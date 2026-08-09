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
import ValueSnapshot from '../models/ValueSnapshot';
import { logger } from '../config/logger.config';

/**
 * The effective value of an item: its price for the condition it is in.
 * Mirrors getItemValue on the frontend; both must agree or the chart and the
 * total value KPI show different numbers for the same collection.
 */
export function getValueForItem(item: any): number {
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
