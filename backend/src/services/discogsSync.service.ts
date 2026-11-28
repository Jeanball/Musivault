import axios from 'axios';
import mongoose from 'mongoose';
import CollectionItem from '../models/CollectionItem';
import DiscogsSyncReport, {
    IDiscogsReportFlag,
    IDiscogsReportItem,
    IDiscogsReportMerged,
    IDiscogsReportRelease,
    IDiscogsSyncReport
} from '../models/DiscogsSyncReport';
import User, { IUser } from '../models/User';
import { logger } from '../config/logger.config';
import { DiscogsCollectionPage, DiscogsCollectionRelease } from '../types/discogs.types';
import { decryptSecret } from '../utils/crypto.utils';
import { discogsRequest, normalizeString, parseDiscogsCondition, stripArtistSuffixes, withRateLimitRetry } from '../utils/discogs.utils';

const PAGE_SIZE = 100;
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

export interface InstanceLink {
    itemId: mongoose.Types.ObjectId;
    instanceId: number;
}

export interface ComparisonResult {
    matched: number;
    dateDiffers: number;
    /** The matched items with the Discogs entry (the earliest copy) they matched, for the apply step. */
    matchedItems: { itemId: mongoose.Types.ObjectId; release: IDiscogsReportRelease }[];
    /** Matched items whose Discogs collection entry is beyond doubt and not stored yet, to be saved. */
    clearLinks: InstanceLink[];
    flags: IDiscogsReportFlag[];
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

/** The same format, compared by name ignoring case; an item with no format fits any. */
function formatFits(item: ComparableItem, entry: DiscogsCollectionRelease): boolean {
    const itemFormat = item.format?.toLowerCase();
    return !itemFormat || !!entry.basic_information.formats?.some(f => f.name.toLowerCase() === itemFormat);
}

/** The same year, compared only when both sides have one (Discogs reports 0 for "unknown"). */
function yearFits(item: ComparableItem, entry: DiscogsCollectionRelease): boolean {
    const itemYear = Number(item.year);
    const releaseYear = entry.basic_information.year;
    return !(itemYear && releaseYear && itemYear !== releaseYear);
}

const reportItem = ({ addedAt: _addedAt, instanceId: _instanceId, ...item }: ComparableItem): IDiscogsReportItem => item;

/**
 * Relate the items left "only in Musivault" to what they might be, for the user to judge (see
 * `IDiscogsReportFlag`). At most one flag per item, the surest first: its own Discogs entry on another
 * item's release, then a look-alike item that already has a release, then a look-alike new release.
 * Look-alike means the same normalized artist and title and a fitting format. Items without a Discogs id
 * (manual albums) are not flagged: Discogs can't have moved them. Pure.
 */
function findFlags(
    leftovers: ComparableItem[],
    items: ComparableItem[],
    newReleases: IDiscogsReportRelease[],
    discogs: { earliestByRelease: Map<number, DiscogsCollectionRelease>; byInstance: Map<number, DiscogsCollectionRelease>; copies: Map<number, number> }
): IDiscogsReportFlag[] {
    const { earliestByRelease, byInstance, copies } = discogs;
    const claimedMoves = new Set<number>();
    const keyOf = (item: ComparableItem) => pairKey(item.artist, item.title);

    return leftovers.flatMap((comparable): IDiscogsReportFlag[] => {
        if (comparable.discogsId === undefined) return [];
        const item = reportItem(comparable);

        const own = comparable.instanceId !== undefined ? byInstance.get(comparable.instanceId) : undefined;
        const holder = own && items.find(i => i.itemId !== comparable.itemId && i.discogsId === own.id);
        if (own && holder) {
            const kind = (copies.get(own.id) ?? 0) > 1 ? 'sharedRelease' : 'possibleDuplicate';
            return [{ kind, item, release: releaseOf(own), other: reportItem(holder) }];
        }

        for (const other of items) {
            if (other.itemId === comparable.itemId || other.discogsId === undefined || keyOf(other) !== keyOf(comparable)) continue;
            const entry = earliestByRelease.get(other.discogsId);
            if (entry && copies.get(entry.id) === 1 && formatFits(comparable, entry)) {
                return [{ kind: 'possibleDuplicate', item, release: releaseOf(entry), other: reportItem(other) }];
            }
        }

        const move = newReleases.find(release => {
            const entry = earliestByRelease.get(release.releaseId);
            return entry && !claimedMoves.has(release.releaseId) && pairKey(release.artist, release.title) === keyOf(comparable)
                && formatFits(comparable, entry) && !yearFits(comparable, entry);
        });
        if (!move) return [];
        claimedMoves.add(move.releaseId);
        return [{ kind: 'possibleMove', item, release: move }];
    });
}

/**
 * Compare a user's Discogs collection with their Musivault items. Pure: no I/O.
 *
 * An item is matched to Discogs in this order, each step only for items the one before left over:
 * 1. **A moved instance id.** The item's stored `instanceId` is a Discogs entry on another release than
 *    the item's, and no item has that release: Discogs moved the entry, so the release was merged. Exact
 *    (`match: 'instance'`). It comes first because the item's old release can still be in the collection
 *    through another copy, which is not this item's (#69). Instance ids are stored by the apply step, so
 *    this only works from then on. Only one item can claim a release.
 * 2. **Release id.** The item's album is in the Discogs collection. Never release + format, so an LP
 *    and a CD release of the same album stay separate, while an item matches its release whatever
 *    format Discogs lists. Several copies of one release count once; the earliest `date_added` is
 *    the one that counts.
 * 3. **The guess.** The same normalized artist and title, the same format (an item's LP never pairs with
 *    a CD or cassette release) and the same year when both are known, with a "new" Discogs entry. A
 *    guess (`match: 'guess'`), shown as "likely". Each Discogs entry is used at most once; when in doubt
 *    the item stays in `onlyInMusivault` and the release in `newOnDiscogs`.
 *
 * - `matched`: items matched by release id. `dateDiffers` counts those whose `addedAt` is more than
 *   a day from the Discogs `date_added` (e.g. everything a CSV import stamped with the import date).
 * - `clearLinks`: matched items with no stored instance id, where one item and one Discogs entry have that
 *   release and no item stores the entry's id. With several items or copies nothing is linked: a wrong
 *   link would later move the wrong record.
 * - `flags`: leftovers related to a release or another item, for the user to look at (see `findFlags`).
 *   Flagged rows stay in `onlyInMusivault` and `newOnDiscogs`.
 * - `newOnDiscogs`: releases in Discogs that no item has and that no merge explains.
 * - `onlyInMusivault`: items left over, including manually added albums with no Discogs id.
 *
 * Empty inputs give empty results. Never throws and never touches the arguments.
 */
export function compareCollections(discogs: DiscogsCollectionRelease[], items: ComparableItem[]): ComparisonResult {
    const earliestByRelease = new Map<number, DiscogsCollectionRelease>();
    const byInstance = new Map<number, DiscogsCollectionRelease>();
    const copies = new Map<number, number>();
    for (const entry of discogs) {
        byInstance.set(entry.instance_id, entry);
        copies.set(entry.id, (copies.get(entry.id) ?? 0) + 1);
        const known = earliestByRelease.get(entry.id);
        if (!known || new Date(entry.date_added) < new Date(known.date_added)) {
            earliestByRelease.set(entry.id, entry);
        }
    }

    const itemReleaseIds = new Set(items.map(i => i.discogsId));
    const merged: IDiscogsReportMerged[] = [];
    const paired = new Set<number>();
    const unmoved: ComparableItem[] = [];
    for (const comparable of items) {
        const entry = comparable.instanceId !== undefined ? byInstance.get(comparable.instanceId) : undefined;
        // `itemReleaseIds` also rules out an entry that is still on the item's own release.
        if (entry && !itemReleaseIds.has(entry.id) && !paired.has(entry.id)) {
            const { addedAt: _addedAt, instanceId: _instanceId, ...item } = comparable;
            merged.push({ item, release: releaseOf(entry), match: 'instance' });
            paired.add(entry.id);
        } else {
            unmoved.push(comparable);
        }
    }

    let matched = 0;
    let dateDiffers = 0;
    const matchedItems: ComparisonResult['matchedItems'] = [];
    const unmatched: ComparableItem[] = [];
    const ownedReleaseIds = new Set<number>();

    for (const item of unmoved) {
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
    for (const comparable of unmatched) {
        const { addedAt: _addedAt, instanceId: _instanceId, ...item } = comparable;
        const options = candidates.get(pairKey(item.artist, item.title)) ?? [];
        const index = options.findIndex(entry => formatFits(comparable, entry) && yearFits(comparable, entry));
        if (index === -1) {
            onlyInMusivault.push(item);
            continue;
        }
        const [entry] = options.splice(index, 1);
        merged.push({ item, release: releaseOf(entry), match: 'guess' });
        paired.add(entry.id);
    }

    const storedInstanceIds = new Set(items.map(i => i.instanceId));
    const clearLinks = unmoved.flatMap(item => {
        const entry = item.discogsId !== undefined ? earliestByRelease.get(item.discogsId) : undefined;
        const isClear = entry
            && item.instanceId === undefined
            && copies.get(entry.id) === 1
            && items.filter(other => other.discogsId === entry.id).length === 1
            && !storedInstanceIds.has(entry.instance_id);
        return isClear ? [{ itemId: item.itemId, instanceId: entry.instance_id }] : [];
    });

    const stillNew = newOnDiscogs.filter(r => !paired.has(r.releaseId));
    const leftoverIds = new Set(onlyInMusivault.map(i => i.itemId));
    const flags = findFlags(
        items.filter(i => leftoverIds.has(i.itemId)), items, stillNew, { earliestByRelease, byInstance, copies }
    );

    return {
        matched,
        dateDiffers,
        matchedItems,
        clearLinks,
        flags,
        newOnDiscogs: stillNew,
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

function fetchPage(username: string, token: string, page: number): Promise<DiscogsCollectionPage> {
    return withRateLimitRetry(
        () => discogsRequest<DiscogsCollectionPage>(
            `/users/${encodeURIComponent(username)}/collection/folders/0/releases`,
            { sort: 'added', sort_order: 'asc', per_page: PAGE_SIZE, page },
            { token, applyRateLimit: page > 1 }
        ),
        { context: `collection page ${page}` }
    );
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
            instanceId: item.discogsInstanceId ?? undefined
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

/**
 * Save the Discogs entry of items that have none stored, so a later merge is found exactly. Writes only
 * `discogsInstanceId`, and never over an id that is already there.
 */
export async function storeInstanceLinks(userId: mongoose.Types.ObjectId, links: InstanceLink[]): Promise<void> {
    if (links.length === 0) return;
    await CollectionItem.bulkWrite(links.map(l => ({
        updateOne: {
            filter: { _id: l.itemId, user: userId, discogsInstanceId: null },
            update: { $set: { discogsInstanceId: l.instanceId } }
        }
    })));
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
            onlyInMusivault: result.onlyInMusivault,
            flags: result.flags
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
        await storeInstanceLinks(userId, result.clearLinks);
        await saveResult(userId, releases, result);
        logger.info({ userId: String(userId), releases: releases.length, linked: result.clearLinks.length }, '[DiscogsCheck] Completed');
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

/**
 * Run `job` after the jobs already queued. The user counts as busy until it settles.
 * Returns a promise for when it has run; a job that throws doesn't block the ones after it.
 */
export function enqueueJob(userId: mongoose.Types.ObjectId, job: () => Promise<void>): Promise<void> {
    const key = String(userId);
    activeUsers.add(key);
    const run = queue
        .then(job)
        .finally(() => { activeUsers.delete(key); });
    queue = run.catch(() => undefined);
    return run;
}

/**
 * Start a read-only check of the user's Discogs collection against their items, in the background.
 * Checks run one at a time; extra ones wait with status `queued`. Returns the report straight away
 * (poll it with `getReport`). If this user already has a check queued or running, that report is
 * returned instead of starting another. Makes one Discogs call per 100 releases, paced by `RATE_LIMIT_MS`.
 * @throws DiscogsCheckError if no account is connected or it needs reconnecting
 */
export async function startCheck(userId: mongoose.Types.ObjectId): Promise<IDiscogsSyncReport> {
    return (await beginCheck(userId)).report;
}

/** `startCheck`, also handing back a promise for when the check has run (already settled if one was running). */
async function beginCheck(userId: mongoose.Types.ObjectId): Promise<{ report: IDiscogsSyncReport; finished: Promise<void> }> {
    const user = await User.findById(userId);
    if (!user?.discogs?.enabled) {
        throw new DiscogsCheckError('notConnected', 'No Discogs account is connected.');
    }
    if (user.discogs.needsReconnect) {
        throw new DiscogsCheckError('needsReconnect', 'Discogs no longer accepts the stored token.');
    }

    const existing = await DiscogsSyncReport.findOne({ user: userId });
    if (existing && hasActiveJob(userId)) {
        return { report: existing, finished: Promise.resolve() };
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
                onlyInMusivault: [],
                flags: []
            },
            $unset: { errorCode: '', finishedAt: '', apply: '' }
        },
        { upsert: true, new: true }
    );

    return { report, finished: enqueueJob(userId, () => runCheck(userId)) };
}

/** How a `checkAllUsers` run went. */
export interface CheckAllResult {
    /** Checks that completed. */
    checked: number;
    /** Checks that failed, including those where Discogs rejected the token. */
    failed: number;
    /** Users left out because a check or an apply of theirs was already running. */
    skipped: number;
}

/**
 * Check the Discogs collection of every user who has sync on and a working token, one after another
 * through the shared queue (so it never competes with a user's own check for Discogs' rate limit).
 * Read-only: it refreshes each user's report and never applies anything. A user whose check fails
 * doesn't stop the others; their report carries the error. Users that need reconnecting are not tried.
 * `onUser` is called before each check, with its position.
 */
export async function checkAllUsers(
    onUser?: (current: number, total: number, username: string) => void
): Promise<CheckAllResult> {
    const users = await User.find({ 'discogs.enabled': true, 'discogs.needsReconnect': { $ne: true } })
        .select('_id discogs.username');
    const result: CheckAllResult = { checked: 0, failed: 0, skipped: 0 };

    for (const [index, user] of users.entries()) {
        if (hasActiveJob(user._id)) {
            result.skipped++;
            continue;
        }
        onUser?.(index + 1, users.length, user.discogs?.username ?? '');
        try {
            const { finished } = await beginCheck(user._id);
            await finished;
            const report = await DiscogsSyncReport.findOne({ user: user._id });
            if (report?.status === 'completed') result.checked++;
            else result.failed++;
        } catch (error) {
            logger.warn({ err: error, userId: String(user._id) }, '[DiscogsCheck] Scheduled check could not start');
            result.failed++;
        }
    }
    return result;
}

/** What the last check left to act on, for the badge and the notice. */
export interface PendingSummary {
    finishedAt: Date;
    /** New records, without those a possible move is flagged for. */
    newOnDiscogs: number;
    merged: number;
    /** Rows flagged for the user to look at. */
    flagged: number;
}

/**
 * The counts the user can act on from their last completed check: records new on Discogs and merged
 * ones. Date differences and "only in Musivault" are left out on purpose, since nobody is asked to do
 * anything about them. Counts are of the stored result, so they drop as soon as an apply has run.
 * Null when sync is off or needs reconnecting, or there is no completed check.
 */
export async function getPendingSummary(user: IUser): Promise<PendingSummary | null> {
    if (!user.discogs?.enabled || user.discogs.needsReconnect) return null;
    const report = await DiscogsSyncReport.findOne({ user: user._id, status: 'completed' })
        .select('finishedAt startedAt counts flags.kind');
    if (!report) return null;
    return {
        finishedAt: report.finishedAt ?? report.startedAt,
        // A possible move relates a new release: count it once, as a flag.
        newOnDiscogs: report.counts.newOnDiscogs - (report.flags ?? []).filter(f => f.kind === 'possibleMove').length,
        merged: report.counts.merged,
        flagged: report.flags?.length ?? 0
    };
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
