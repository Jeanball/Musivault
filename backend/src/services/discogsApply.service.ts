import mongoose from 'mongoose';
import CollectionItem from '../models/CollectionItem';
import DiscogsSyncReport, {
    IDiscogsApplyFailure,
    IDiscogsReportMerged,
    IDiscogsReportRelease
} from '../models/DiscogsSyncReport';
import User from '../models/User';
import { logger } from '../config/logger.config';
import { buildPriceCache } from '../utils/price.utils';
import {
    ComparableItem,
    ComparisonResult,
    compareCollections,
    DATE_TOLERANCE_MS,
    enqueueJob,
    fetchCollection,
    flagRejectedToken,
    getReport,
    hasActiveJob,
    loadItems,
    logConfirmedMerges,
    saveResult
} from './discogsSync.service';
import { discogsService } from './discogs.service';
import { processImportRow, upsertAlbumFromDiscogs } from './import.service';
import { rebuildValueHistory, recordValueSnapshot } from './valueSnapshot.service';

/** Failures kept in the report; the counts always show the full numbers. */
const MAX_FAILURES = 100;

/** What the user ticked. Nothing outside of it is changed. */
export interface ApplySelection {
    /** Discogs release ids from "New on Discogs". */
    add: number[];
    /** Items from "Merged on Discogs", each with the release it should point to. */
    relink: { itemId: string; releaseId: number }[];
    /** Set `addedAt` of matched items to the date they were added on Discogs. */
    useDiscogsDates: boolean;
}

/** Thrown by `startApply`; `code` is what the API reports. */
export class DiscogsApplyError extends Error {
    constructor(readonly code: 'notConnected' | 'needsReconnect' | 'noReport' | 'busy' | 'nothingSelected' | 'notRunning', message: string) {
        super(message);
    }
}

type Failure = IDiscogsApplyFailure;

// Users who asked to stop their running apply. Checked between records, so a stop never leaves one half done.
const stopRequests = new Set<string>();

/**
 * Point an item at the release Discogs merged its release into. The item keeps everything of its own:
 * condition, notes, custom fields, added date and the format it was stored with. What follows the new
 * release: the album (found or created from the release, never edited in place, so other users who
 * own the old release are not affected), the format details, the price, and the Discogs instance id.
 * Makes two Discogs calls (release, price), retrying after a wait when Discogs throttles them.
 * @returns a reason when the item was not relinked, because it would duplicate another item
 * @throws if Discogs does not return the release
 */
export async function relinkItem(
    userId: mongoose.Types.ObjectId,
    itemId: mongoose.Types.ObjectId | string,
    release: Pick<IDiscogsReportRelease, 'releaseId' | 'instanceId'>
): Promise<string | undefined> {
    const item = await CollectionItem.findOne({ _id: itemId, user: userId });
    if (!item) return 'Item no longer in your collection';

    const found = await discogsService.fetchByReleaseId(release.releaseId, { retryOnRateLimit: true });
    if (!found) throw new Error('Release not found on Discogs');
    const album = await upsertAlbumFromDiscogs(found);

    const duplicate = await CollectionItem.exists({
        user: userId,
        album: album._id,
        'format.name': item.format.name,
        _id: { $ne: item._id }
    });
    if (duplicate) return 'Already in your collection under the new release';

    const formatDetails = found.formats?.find(f => f.name.toLowerCase() === item.format.name.toLowerCase());
    if (formatDetails) {
        item.format.descriptions = formatDetails.descriptions || [];
        item.format.text = formatDetails.text || '';
    }
    item.album = album._id as mongoose.Types.ObjectId;
    item.discogsInstanceId = release.instanceId;
    item.formatVerification = null;
    item.priceCache = buildPriceCache(await discogsService.getMarketplaceStats(release.releaseId, { retryOnRateLimit: true }));
    await item.save();
    return undefined;
}

/** What an apply will do, worked out from today's comparison and the user's ticks. */
export interface ApplyPlan {
    /** Matched items that have no stored Discogs entry yet, with the one to store. */
    linkInstances: { itemId: mongoose.Types.ObjectId; instanceId: number }[];
    /** Ticked merges. `merged` is missing when the row no longer holds (it was merged elsewhere, or is gone). */
    relinks: { itemId: string; releaseId: number; merged?: IDiscogsReportMerged }[];
    /** Ticked new records. `release` is missing when the record is no longer new (already added, or gone from Discogs). */
    adds: { releaseId: number; release?: IDiscogsReportRelease }[];
    /** With `useDiscogsDates`: matched items whose date added is off by more than a day, and the Discogs date. */
    dateUpdates: { itemId: mongoose.Types.ObjectId; addedAt: Date }[];
}

/**
 * Work out what an apply does. Pure: no I/O.
 *
 * Only what the user ticked is planned, and only if it still holds in `result` (a fresh comparison):
 * a ticked row that is no longer a merge, or no longer new, comes back without its `merged`/`release`
 * and is skipped, never guessed at. A relink also needs the release the user saw (`releaseId`) to still
 * be the one the item pairs with. Dates are planned only with `useDiscogsDates`, and only for items
 * matched by release id, so relinked and added items keep their own date. The instance ids to store
 * are not a tick: they are invisible link data, only ever set on items that don't have one.
 */
export function planApply(result: ComparisonResult, items: ComparableItem[], selection: ApplySelection): ApplyPlan {
    const itemById = new Map(items.map(i => [String(i.itemId), i]));
    const mergedByItem = new Map(result.merged.map(m => [String(m.item.itemId), m]));
    const newById = new Map(result.newOnDiscogs.map(r => [r.releaseId, r]));

    return {
        linkInstances: result.matchedItems
            .filter(m => itemById.get(String(m.itemId))?.instanceId === undefined)
            .map(m => ({ itemId: m.itemId, instanceId: m.release.instanceId })),
        relinks: selection.relink.map(r => {
            const merged = mergedByItem.get(r.itemId);
            return { ...r, merged: merged?.release.releaseId === r.releaseId ? merged : undefined };
        }),
        adds: selection.add.map(releaseId => ({ releaseId, release: newById.get(releaseId) })),
        dateUpdates: selection.useDiscogsDates
            ? result.matchedItems.flatMap(m => {
                const addedAt = itemById.get(String(m.itemId))?.addedAt;
                const differs = addedAt && Math.abs(addedAt.getTime() - m.release.dateAdded.getTime()) > DATE_TOLERANCE_MS;
                return differs ? [{ itemId: m.itemId, addedAt: m.release.dateAdded }] : [];
            })
            : []
    };
}

function pushFailure(failures: Failure[], failure: Failure): void {
    if (failures.length < MAX_FAILURES) failures.push(failure);
}

async function runApply(userId: mongoose.Types.ObjectId, selection: ApplySelection): Promise<void> {
    const key = String(userId);
    const stopRequested = () => stopRequests.has(key);
    const update = (fields: Record<string, unknown>) => {
        const set = Object.fromEntries(Object.entries(fields).map(([key, value]) => [`apply.${key}`, value]));
        return DiscogsSyncReport.updateOne({ user: userId }, { $set: set });
    };

    try {
        // Stopped while still queued: end without reading Discogs or touching anything.
        if (stopRequested()) {
            await update({ status: 'completed', finishedAt: new Date(), stopped: true });
            return;
        }
        await update({ status: 'running', phase: 'collection' });

        // Read Discogs afresh: the check may be old, and what is ticked is validated against today's state.
        const releases = await fetchCollection(userId);
        const items = await loadItems(userId);
        const result = compareCollections(releases, items);
        logConfirmedMerges(result, 'DiscogsApply');
        const plan = planApply(result, items, selection);

        // Link matched items to their Discogs entry. Invisible to the user, and what makes later merges exact.
        if (plan.linkInstances.length > 0) {
            await CollectionItem.bulkWrite(plan.linkInstances.map(l => ({
                updateOne: {
                    filter: { _id: l.itemId, user: userId },
                    update: { $set: { discogsInstanceId: l.instanceId } }
                }
            })));
        }
        await update({ instanceIdsStored: plan.linkInstances.length });
        await update({ phase: 'records', total: plan.relinks.length + plan.adds.length });

        const failures: Failure[] = [];
        let done = 0;
        let failed = 0;
        let skipped = 0;
        let relinked = 0;
        let added = 0;
        const progress = () => update({ done, failed, skipped, relinked, added, failures });

        let stopped = false;
        for (const { itemId, releaseId, merged } of plan.relinks) {
            if (stopRequested()) { stopped = true; break; }
            if (!merged) {
                skipped++;
            } else {
                const label = { kind: 'relink' as const, artist: merged.item.artist, title: merged.item.title, releaseId };
                try {
                    const reason = await relinkItem(userId, itemId, merged.release);
                    if (reason) {
                        skipped++;
                        pushFailure(failures, { ...label, reason });
                    } else {
                        relinked++;
                    }
                } catch (err) {
                    logger.warn({ err, itemId, releaseId }, '[DiscogsApply] Relink failed');
                    failed++;
                    pushFailure(failures, { ...label, reason: err instanceof Error ? err.message : 'Relink failed' });
                }
            }
            done++;
            await progress();
        }

        for (const { releaseId, release } of stopped ? [] : plan.adds) {
            if (stopRequested()) { stopped = true; break; }
            if (!release) {
                skipped++;
            } else {
                const label = { kind: 'add' as const, artist: release.artist, title: release.title, releaseId };
                try {
                    // The import path, so the album comes in complete: tracklist, labels, styles, format details, price.
                    const row = await processImportRow(
                        {
                            releaseId: String(releaseId),
                            artist: release.artist,
                            album: release.title,
                            mediaCondition: release.mediaCondition,
                            sleeveCondition: release.sleeveCondition
                        },
                        userId,
                        { formatName: release.format, addedAt: release.dateAdded, discogsInstanceId: release.instanceId, retryOnRateLimit: true }
                    );
                    if (row.success) {
                        added++;
                    } else if (row.skipped) {
                        skipped++;
                        pushFailure(failures, { ...label, reason: row.reason ?? 'Skipped' });
                    } else {
                        failed++;
                        pushFailure(failures, { ...label, reason: row.reason ?? 'Import failed' });
                    }
                } catch (err) {
                    logger.warn({ err, releaseId }, '[DiscogsApply] Add failed');
                    failed++;
                    pushFailure(failures, { ...label, reason: err instanceof Error ? err.message : 'Import failed' });
                }
            }
            done++;
            await progress();
        }

        // A stopped apply leaves the dates alone too: the user asked for it to end, not to finish part of the rest.
        const datesUpdated = stopped ? 0 : plan.dateUpdates.length;
        if (datesUpdated > 0) {
            await update({ phase: 'dates' });
            await CollectionItem.bulkWrite(plan.dateUpdates.map(d => ({
                updateOne: {
                    filter: { _id: d.itemId, user: userId },
                    update: { $set: { addedAt: d.addedAt } }
                }
            })));
            // The value history is derived from the dates added, so it follows them.
            await rebuildValueHistory(userId, { replaceSeeded: true });
            await recordValueSnapshot(userId);
        }

        // What is left to do, from what was just read and done; no second pass over Discogs.
        await saveResult(userId, releases, compareCollections(releases, await loadItems(userId)));
        await update({ status: 'completed', finishedAt: new Date(), datesUpdated, stopped });
        logger.info(
            { userId: String(userId), added, relinked, skipped, failed, datesUpdated, stopped },
            '[DiscogsApply] Completed'
        );
    } catch (error) {
        const rejected = await flagRejectedToken(userId, error);
        logger.error({ err: error, userId: String(userId) }, '[DiscogsApply] Failed');
        await update({ status: 'error', errorCode: rejected ? 'needsReconnect' : 'failed', finishedAt: new Date() });
    } finally {
        stopRequests.delete(key);
    }
}

/**
 * Apply the rows the user ticked in the last check, in the background: relink merged items, add new
 * records, and optionally set dates added from Discogs (which rebuilds the value history).
 * The job re-reads the Discogs collection first and only does what still holds; a ticked row whose
 * situation changed is skipped, never guessed at. It also links the user's matched items to their
 * Discogs entries (`discogsInstanceId`) so later merges are found exactly.
 * Runs in the same queue as checks (one Discogs job at a time). Each added record costs about two
 * Discogs calls, so a large apply takes a while; poll `getReport` for `apply`.
 * @throws DiscogsApplyError if no account is connected or it needs reconnecting, there is no check
 * to apply from, a job is already running, or nothing is ticked
 */
export async function startApply(userId: mongoose.Types.ObjectId, selection: ApplySelection): Promise<void> {
    const user = await User.findById(userId);
    if (!user?.discogs?.enabled) {
        throw new DiscogsApplyError('notConnected', 'No Discogs account is connected.');
    }
    if (user.discogs.needsReconnect) {
        throw new DiscogsApplyError('needsReconnect', 'Discogs no longer accepts the stored token.');
    }
    if (selection.add.length + selection.relink.length === 0 && !selection.useDiscogsDates) {
        throw new DiscogsApplyError('nothingSelected', 'Nothing is selected.');
    }
    if (hasActiveJob(userId)) {
        throw new DiscogsApplyError('busy', 'A Discogs job is already running.');
    }

    stopRequests.delete(String(userId));
    // Settles a job a server restart interrupted, so it doesn't block a new one.
    await getReport(userId);
    // The filter is the lock: two requests can't both start an apply.
    const started = await DiscogsSyncReport.updateOne(
        { user: userId, status: 'completed', 'apply.status': { $nin: ['queued', 'running'] } },
        {
            $set: {
                apply: {
                    status: 'queued',
                    phase: 'collection',
                    startedAt: new Date(),
                    useDiscogsDates: selection.useDiscogsDates,
                    failures: []
                }
            }
        }
    );
    if (started.matchedCount === 0) {
        const report = await DiscogsSyncReport.findOne({ user: userId });
        if (report?.status === 'completed') throw new DiscogsApplyError('busy', 'A Discogs job is already running.');
        throw new DiscogsApplyError('noReport', 'Run a check first.');
    }

    enqueueJob(userId, () => runApply(userId, selection));
}

/**
 * Ask the user's running apply to stop. It finishes the record it is on, keeps everything already
 * done, and ends as completed with `stopped` set; dates are not touched. The rest can be applied later
 * from a new check. Works on a queued apply too, which then ends without doing anything.
 * @throws DiscogsApplyError `notRunning` when no apply is queued or running
 */
export async function stopApply(userId: mongoose.Types.ObjectId): Promise<void> {
    const running = hasActiveJob(userId)
        && await DiscogsSyncReport.exists({ user: userId, 'apply.status': { $in: ['queued', 'running'] } });
    if (!running) {
        throw new DiscogsApplyError('notRunning', 'No apply is running.');
    }
    stopRequests.add(String(userId));
    await DiscogsSyncReport.updateOne({ user: userId }, { $set: { 'apply.stopRequested': true } });
}
