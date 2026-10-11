import axios from 'axios';
import mongoose from 'mongoose';
import CollectionItem from '../models/CollectionItem';
import DiscogsSyncReport, {
    IDiscogsReportItem,
    IDiscogsReportMerged,
    IDiscogsReportRelease,
    IDiscogsSyncReport
} from '../models/DiscogsSyncReport';
import User, { IUser } from '../models/User';
import { logger } from '../config/logger.config';
import { DiscogsCollectionPage, DiscogsCollectionRelease } from '../types/discogs.types';
import { decryptSecret } from '../utils/crypto.utils';
import { delay, discogsRequest, normalizeString, parseDiscogsCondition, stripArtistSuffixes } from '../utils/discogs.utils';

const PAGE_SIZE = 100;
const RATE_LIMIT_RETRY_MS = 30_000;
const MAX_RATE_LIMIT_RETRIES = 3;
/** Added dates closer than this are the same day for our purposes (timezones, import time of day). */
export const DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** Thrown by `startCheck` when the user can't run a check; `code` is what the API reports. */
export class DiscogsCheckError extends Error {
    constructor(readonly code: 'notConnected' | 'needsReconnect', message: string) {
        super(message);
    }
}

/**
 * A Musivault item reduced to what the comparison needs. `discogsId` is missing on manually added albums;
 * `instanceId` is the Discogs collection entry the item was linked to by an earlier apply, if any.
 */
export interface ComparableItem extends IDiscogsReportItem {
    addedAt: Date;
    instanceId?: number;
}

export interface ComparisonResult {
    matched: number;
    dateDiffers: number;
    /** The matched items with the Discogs entry (the earliest copy) they matched, for the apply step. */
    matchedItems: { itemId: mongoose.Types.ObjectId; release: IDiscogsReportRelease }[];
    newOnDiscogs: IDiscogsReportRelease[];
    merged: IDiscogsReportMerged[];
    onlyInMusivault: IDiscogsReportItem[];
}

function releaseOf(entry: DiscogsCollectionRelease): IDiscogsReportRelease {
    const info = entry.basic_information;
    const field = (id: number) => entry.notes?.find(n => n.field_id === id)?.value;
    return {
        releaseId: entry.id,
        instanceId: entry.instance_id,
        artist: stripArtistSuffixes((info.artists ?? []).map(a => a.name).join(', ')),
        title: info.title,
        year: info.year || undefined,
        thumb: info.thumb || undefined,
        format: info.formats?.[0]?.name,
        dateAdded: new Date(entry.date_added),
        mediaCondition: parseDiscogsCondition(field(1)),
        sleeveCondition: parseDiscogsCondition(field(2), { sleeve: true })
    };
}

const pairKey = (artist: string, title: string) => `${normalizeString(artist)}|${normalizeString(title)}`;

/**
 * Whether a Discogs entry could be the release an item was meant to be: the same format
 * (compared by name, ignoring case; an item with no format fits any) and the same year
 * (only compared when both sides have one; Discogs reports 0 for "unknown").
 */
function couldBeSameRecord(item: ComparableItem, entry: DiscogsCollectionRelease): boolean {
    const itemFormat = item.format?.toLowerCase();
    if (itemFormat && !entry.basic_information.formats?.some(f => f.name.toLowerCase() === itemFormat)) {
        return false;
    }
    const itemYear = Number(item.year);
    const releaseYear = entry.basic_information.year;
    return !(itemYear && releaseYear && itemYear !== releaseYear);
}

/**
 * Compare a user's Discogs collection with their Musivault items. Pure: no I/O.
 *
 * An item is matched to Discogs in this order, each step only for items the one before left over:
 * 1. **Release id.** The item's album is in the Discogs collection. Never release + format, so an LP
 *    and a CD release of the same album stay separate, while an item matches its release whatever
 *    format Discogs lists. Several copies of one release count once; the earliest `date_added` is
 *    the one that counts.
 * 2. **Instance id.** The item's stored `instanceId` is a Discogs entry whose release is not owned
 *    by another item: Discogs moved the entry to another release, so the release was merged. Exact
 *    (`match: 'instance'`). Instance ids are stored by the apply step, so this only works from then on.
 * 3. **The guess.** The same normalized artist and title, the same format (an item's LP never pairs with
 *    a CD or cassette release) and the same year when both are known, with a "new" Discogs entry. A
 *    guess (`match: 'guess'`), shown as "likely". Each Discogs entry is used at most once; when in doubt
 *    the item stays in `onlyInMusivault` and the release in `newOnDiscogs`.
 *
 * - `matched`: items matched by release id. `dateDiffers` counts those whose `addedAt` is more than
 *   a day from the Discogs `date_added` (e.g. everything a CSV import stamped with the import date).
 * - `newOnDiscogs`: releases in Discogs that no item has and that no merge explains.
 * - `onlyInMusivault`: items left over, including manually added albums with no Discogs id.
 *
 * Empty inputs give empty results. Never throws and never touches the arguments.
 */
export function compareCollections(discogs: DiscogsCollectionRelease[], items: ComparableItem[]): ComparisonResult {
    const earliestByRelease = new Map<number, DiscogsCollectionRelease>();
    const byInstance = new Map<number, DiscogsCollectionRelease>();
    for (const entry of discogs) {
        byInstance.set(entry.instance_id, entry);
        const known = earliestByRelease.get(entry.id);
        if (!known || new Date(entry.date_added) < new Date(known.date_added)) {
            earliestByRelease.set(entry.id, entry);
        }
    }

    let matched = 0;
    let dateDiffers = 0;
    const matchedItems: ComparisonResult['matchedItems'] = [];
    const unmatched: ComparableItem[] = [];
    const ownedReleaseIds = new Set<number>();

    for (const item of items) {
        const entry = item.discogsId !== undefined ? earliestByRelease.get(item.discogsId) : undefined;
        if (!entry) {
            unmatched.push(item);
            continue;
        }
        matched++;
        ownedReleaseIds.add(entry.id);
        matchedItems.push({ itemId: item.itemId, release: releaseOf(entry) });
        if (Math.abs(item.addedAt.getTime() - new Date(entry.date_added).getTime()) > DATE_TOLERANCE_MS) {
            dateDiffers++;
        }
    }

    const merged: IDiscogsReportMerged[] = [];
    const paired = new Set<number>();
    const afterInstance: ComparableItem[] = [];
    for (const comparable of unmatched) {
        const entry = comparable.instanceId !== undefined ? byInstance.get(comparable.instanceId) : undefined;
        if (entry && !ownedReleaseIds.has(entry.id) && !paired.has(entry.id)) {
            const { addedAt: _addedAt, instanceId: _instanceId, ...item } = comparable;
            merged.push({ item, release: releaseOf(entry), match: 'instance' });
            paired.add(entry.id);
        } else {
            afterInstance.push(comparable);
        }
    }

    const candidates = new Map<string, DiscogsCollectionRelease[]>();
    const newOnDiscogs: IDiscogsReportRelease[] = [];
    for (const entry of earliestByRelease.values()) {
        if (ownedReleaseIds.has(entry.id) || paired.has(entry.id)) continue;
        const release = releaseOf(entry);
        newOnDiscogs.push(release);
        const key = pairKey(release.artist, release.title);
        candidates.set(key, [...(candidates.get(key) ?? []), entry]);
    }

    const onlyInMusivault: IDiscogsReportItem[] = [];
    for (const comparable of afterInstance) {
        const { addedAt: _addedAt, instanceId: _instanceId, ...item } = comparable;
        const options = candidates.get(pairKey(item.artist, item.title)) ?? [];
        const index = options.findIndex(entry => couldBeSameRecord(comparable, entry));
        if (index === -1) {
            onlyInMusivault.push(item);
            continue;
        }
        const [entry] = options.splice(index, 1);
        merged.push({ item, release: releaseOf(entry), match: 'guess' });
        paired.add(entry.id);
    }

    return {
        matched,
        dateDiffers,
        matchedItems,
        newOnDiscogs: newOnDiscogs.filter(r => !paired.has(r.releaseId)),
        merged,
        onlyInMusivault
    };
}

/**
 * Log the merges found by stored instance id. Each one is proof that Discogs kept the entry's instance id
 * when it merged the releases, which is what the exact matching relies on.
 */
export function logConfirmedMerges(result: ComparisonResult, context: string): void {
    for (const { item, release } of result.merged.filter(m => m.match === 'instance')) {
        logger.info(
            { itemId: String(item.itemId), oldReleaseId: item.discogsId, newReleaseId: release.releaseId, instanceId: release.instanceId },
            `[${context}] Discogs merged a release: the stored instance id now belongs to another release`
        );
    }
}

/** The token to call Discogs with for this user: the instance PAT for `server`, their own for `own`. */
export function resolveToken(user: IUser): string {
    const discogs = user.discogs;
    const token = discogs?.source === 'server'
        ? process.env.DISCOGS_PAT
        : discogs?.tokenEncrypted && decryptSecret(discogs.tokenEncrypted);
    if (!token) {
        throw new Error('No Discogs token available');
    }
    return token;
}

async function fetchPage(username: string, token: string, page: number): Promise<DiscogsCollectionPage> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await discogsRequest<DiscogsCollectionPage>(
                `/users/${encodeURIComponent(username)}/collection/folders/0/releases`,
                { sort: 'added', sort_order: 'asc', per_page: PAGE_SIZE, page },
                { token, applyRateLimit: page > 1 }
            );
        } catch (error) {
            const throttled = axios.isAxiosError(error) && error.response?.status === 429;
            if (!throttled || attempt >= MAX_RATE_LIMIT_RETRIES) throw error;
            logger.warn({ page, attempt }, '[DiscogsCheck] Rate limited by Discogs, waiting before retrying');
            await delay(RATE_LIMIT_RETRY_MS);
        }
    }
}

/** The user's items as the comparison reads them. Items whose album is gone are left out. */
export async function loadItems(userId: mongoose.Types.ObjectId): Promise<ComparableItem[]> {
    const items = await CollectionItem.find({ user: userId })
        .populate<{ album: { discogsId?: number; title: string; artist: string; year: string } }>('album', 'discogsId title artist year')
        .lean();
    return items
        .filter(item => item.album)
        .map(item => ({
            itemId: item._id as mongoose.Types.ObjectId,
            artist: item.album.artist,
            title: item.album.title,
            year: item.album.year,
            format: item.format?.name,
            discogsId: item.album.discogsId,
            addedAt: item.addedAt,
            instanceId: item.discogsInstanceId
        }));
}

/**
 * Read the user's whole Discogs collection, one call per 100 releases, calling `onPage` after each.
 * @throws if the account was disconnected, no token is available, or Discogs fails (a 401 means the token was rejected)
 */
export async function fetchCollection(
    userId: mongoose.Types.ObjectId,
    onPage?: (page: number, pages: number) => Promise<void>
): Promise<DiscogsCollectionRelease[]> {
    const user = await User.findById(userId).select('+discogs.tokenEncrypted');
    if (!user?.discogs) throw new Error('Discogs account was disconnected');
    const { username } = user.discogs;
    const token = resolveToken(user);

    const releases: DiscogsCollectionRelease[] = [];
    let page = 1;
    let pages = 1;
    do {
        const data = await fetchPage(username, token, page);
        pages = data.pagination.pages;
        releases.push(...data.releases);
        await onPage?.(page, pages);
        page++;
    } while (page <= pages);
    return releases;
}

/** Store a comparison as the user's report, replacing the previous result (the apply state is kept). */
export async function saveResult(
    userId: mongoose.Types.ObjectId,
    releases: DiscogsCollectionRelease[],
    result: ComparisonResult
): Promise<void> {
    await DiscogsSyncReport.updateOne({ user: userId }, {
        $set: {
            status: 'completed',
            finishedAt: new Date(),
            counts: {
                discogs: new Set(releases.map(r => r.id)).size,
                matched: result.matched,
                newOnDiscogs: result.newOnDiscogs.length,
                merged: result.merged.length,
                onlyInMusivault: result.onlyInMusivault.length,
                dateDiffers: result.dateDiffers
            },
            newOnDiscogs: result.newOnDiscogs,
            merged: result.merged,
            onlyInMusivault: result.onlyInMusivault
        }
    });
}

/** Whether Discogs rejected the token, in which case the connection is marked as needing a reconnect. */
export async function flagRejectedToken(userId: mongoose.Types.ObjectId, error: unknown): Promise<boolean> {
    const rejected = axios.isAxiosError(error) && error.response?.status === 401;
    if (rejected) {
        await User.updateOne({ _id: userId }, { $set: { 'discogs.needsReconnect': true } });
    }
    return rejected;
}

async function runCheck(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
        await DiscogsSyncReport.updateOne({ user: userId }, { $set: { status: 'running' } });

        const releases = await fetchCollection(userId, (page, pages) =>
            DiscogsSyncReport.updateOne({ user: userId }, { $set: { progress: { page, pages } } }).then(() => undefined)
        );

        const result = compareCollections(releases, await loadItems(userId));
        logConfirmedMerges(result, 'DiscogsCheck');
        await saveResult(userId, releases, result);
        logger.info({ userId: String(userId), releases: releases.length }, '[DiscogsCheck] Completed');
    } catch (error) {
        const rejected = await flagRejectedToken(userId, error);
        logger.error({ err: error, userId: String(userId) }, '[DiscogsCheck] Failed');
        await DiscogsSyncReport.updateOne({ user: userId }, {
            $set: { status: 'error', errorCode: rejected ? 'needsReconnect' : 'failed', finishedAt: new Date() }
        });
    }
}

// One Discogs job (check or apply) at a time across the instance: Discogs rate-limits per IP,
// so every user shares one budget.
const activeUsers = new Set<string>();
let queue: Promise<void> = Promise.resolve();

/** Whether this user has a check or an apply queued or running. */
export function hasActiveJob(userId: mongoose.Types.ObjectId): boolean {
    return activeUsers.has(String(userId));
}

/** Run `job` after the jobs already queued. The user counts as busy until it settles; `job` must not throw. */
export function enqueueJob(userId: mongoose.Types.ObjectId, job: () => Promise<void>): void {
    const key = String(userId);
    activeUsers.add(key);
    queue = queue
        .then(job)
        .finally(() => { activeUsers.delete(key); });
}

/**
 * Start a read-only check of the user's Discogs collection against their items, in the background.
 * Checks run one at a time; extra ones wait with status `queued`. Returns the report straight away
 * (poll it with `getReport`). If this user already has a check queued or running, that report is
 * returned instead of starting another. Makes one Discogs call per 100 releases, paced by `RATE_LIMIT_MS`.
 * @throws DiscogsCheckError if no account is connected or it needs reconnecting
 */
export async function startCheck(userId: mongoose.Types.ObjectId): Promise<IDiscogsSyncReport> {
    const user = await User.findById(userId);
    if (!user?.discogs?.enabled) {
        throw new DiscogsCheckError('notConnected', 'No Discogs account is connected.');
    }
    if (user.discogs.needsReconnect) {
        throw new DiscogsCheckError('needsReconnect', 'Discogs no longer accepts the stored token.');
    }

    const existing = await DiscogsSyncReport.findOne({ user: userId });
    if (existing && hasActiveJob(userId)) {
        return existing;
    }

    const report = await DiscogsSyncReport.findOneAndUpdate(
        { user: userId },
        {
            $set: {
                status: 'queued',
                startedAt: new Date(),
                progress: { page: 0, pages: 0 },
                username: user.discogs.username,
                counts: { discogs: 0, matched: 0, newOnDiscogs: 0, merged: 0, onlyInMusivault: 0, dateDiffers: 0 },
                newOnDiscogs: [],
                merged: [],
                onlyInMusivault: []
            },
            $unset: { errorCode: '', finishedAt: '', apply: '' }
        },
        { upsert: true, new: true }
    );

    enqueueJob(userId, () => runCheck(userId));

    return report;
}

/** The user's latest check, or null if they never ran one. */
export async function getReport(userId: mongoose.Types.ObjectId): Promise<IDiscogsSyncReport | null> {
    const report = await DiscogsSyncReport.findOne({ user: userId });
    // A job that was queued or running when the server restarted would otherwise show "running" forever.
    if (report && !hasActiveJob(userId)) {
        const interrupted = (status?: string) => status === 'queued' || status === 'running';
        if (interrupted(report.status)) {
            report.status = 'error';
            report.errorCode = 'failed';
            report.finishedAt = new Date();
        }
        if (report.apply && interrupted(report.apply.status)) {
            report.apply.status = 'error';
            report.apply.errorCode = 'failed';
            report.apply.finishedAt = new Date();
        }
        if (report.isModified()) await report.save();
    }
    return report;
}
