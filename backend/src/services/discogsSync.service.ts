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
import { delay, discogsRequest, normalizeString, stripArtistSuffixes } from '../utils/discogs.utils';

const PAGE_SIZE = 100;
const RATE_LIMIT_RETRY_MS = 30_000;
const MAX_RATE_LIMIT_RETRIES = 3;
/** Added dates closer than this are the same day for our purposes (timezones, import time of day). */
const DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** Thrown by `startCheck` when the user can't run a check; `code` is what the API reports. */
export class DiscogsCheckError extends Error {
    constructor(readonly code: 'notConnected' | 'needsReconnect', message: string) {
        super(message);
    }
}

/** A Musivault item reduced to what the comparison needs. */
export interface ComparableItem extends IDiscogsReportItem {
    addedAt: Date;
}

export interface ComparisonResult {
    matched: number;
    dateDiffers: number;
    newOnDiscogs: IDiscogsReportRelease[];
    merged: IDiscogsReportMerged[];
    onlyInMusivault: IDiscogsReportItem[];
}

function releaseOf(entry: DiscogsCollectionRelease): IDiscogsReportRelease {
    const info = entry.basic_information;
    return {
        releaseId: entry.id,
        instanceId: entry.instance_id,
        artist: stripArtistSuffixes((info.artists ?? []).map(a => a.name).join(', ')),
        title: info.title,
        year: info.year || undefined,
        thumb: info.thumb || undefined,
        format: info.formats?.[0]?.name,
        dateAdded: new Date(entry.date_added)
    };
}

const pairKey = (artist: string, title: string) => `${normalizeString(artist)}|${normalizeString(title)}`;

/** Whether a Discogs entry could be the release an item was meant to be: same format, same year if both have one. */
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
 * Items match on the Discogs release id alone, never release + format, so an LP and a CD
 * release of the same album stay separate. Owning several copies of one release counts once.
 *
 * - `matched`: the item's release is in the Discogs collection. `dateDiffers` counts those whose
 *   `addedAt` is more than a day from the earliest Discogs `date_added` (e.g. everything a CSV
 *   import stamped with the import date).
 * - `newOnDiscogs`: releases in Discogs that no item has.
 * - `merged`: an item whose release is not in Discogs, paired with a "new" Discogs entry with the
 *   same normalized artist and title, the same format (an item's LP never pairs with a CD or cassette
 *   release) and the same year when both are known: probably the same record after Discogs merged
 *   releases. Each Discogs entry is used at most once. A guess, shown as "likely"; when in doubt the
 *   item stays in `onlyInMusivault` and the release in `newOnDiscogs`.
 * - `onlyInMusivault`: items left over, including manually added albums with no Discogs id.
 */
export function compareCollections(discogs: DiscogsCollectionRelease[], items: ComparableItem[]): ComparisonResult {
    const earliestByRelease = new Map<number, DiscogsCollectionRelease>();
    for (const entry of discogs) {
        const known = earliestByRelease.get(entry.id);
        if (!known || new Date(entry.date_added) < new Date(known.date_added)) {
            earliestByRelease.set(entry.id, entry);
        }
    }

    let matched = 0;
    let dateDiffers = 0;
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
        if (Math.abs(item.addedAt.getTime() - new Date(entry.date_added).getTime()) > DATE_TOLERANCE_MS) {
            dateDiffers++;
        }
    }

    const candidates = new Map<string, DiscogsCollectionRelease[]>();
    const newOnDiscogs: IDiscogsReportRelease[] = [];
    for (const entry of earliestByRelease.values()) {
        if (ownedReleaseIds.has(entry.id)) continue;
        const release = releaseOf(entry);
        newOnDiscogs.push(release);
        const key = pairKey(release.artist, release.title);
        candidates.set(key, [...(candidates.get(key) ?? []), entry]);
    }

    const merged: IDiscogsReportMerged[] = [];
    const onlyInMusivault: IDiscogsReportItem[] = [];
    const paired = new Set<number>();
    for (const comparable of unmatched) {
        const { addedAt: _addedAt, ...item } = comparable;
        const options = candidates.get(pairKey(item.artist, item.title)) ?? [];
        const index = options.findIndex(entry => couldBeSameRecord(comparable, entry));
        if (index === -1) {
            onlyInMusivault.push(item);
            continue;
        }
        const [entry] = options.splice(index, 1);
        merged.push({ item, release: releaseOf(entry) });
        paired.add(entry.id);
    }

    return {
        matched,
        dateDiffers,
        newOnDiscogs: newOnDiscogs.filter(r => !paired.has(r.releaseId)),
        merged,
        onlyInMusivault
    };
}

/** The token to call Discogs with for this user: the instance PAT for `server`, their own for `own`. */
function resolveToken(user: IUser): string {
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

async function loadItems(userId: mongoose.Types.ObjectId): Promise<ComparableItem[]> {
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
            addedAt: item.addedAt
        }));
}

async function runCheck(userId: mongoose.Types.ObjectId): Promise<void> {
    try {
        await DiscogsSyncReport.updateOne({ user: userId }, { $set: { status: 'running' } });

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
            await DiscogsSyncReport.updateOne({ user: userId }, { $set: { progress: { page, pages } } });
            page++;
        } while (page <= pages);

        const result = compareCollections(releases, await loadItems(userId));
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
        logger.info({ userId: String(userId), releases: releases.length }, '[DiscogsCheck] Completed');
    } catch (error) {
        const rejected = axios.isAxiosError(error) && error.response?.status === 401;
        if (rejected) {
            await User.updateOne({ _id: userId }, { $set: { 'discogs.needsReconnect': true } });
        }
        logger.error({ err: error, userId: String(userId) }, '[DiscogsCheck] Failed');
        await DiscogsSyncReport.updateOne({ user: userId }, {
            $set: { status: 'error', errorCode: rejected ? 'needsReconnect' : 'failed', finishedAt: new Date() }
        });
    }
}

// One check at a time across the instance: Discogs rate-limits per IP, so every user shares one budget.
const activeUsers = new Set<string>();
let queue: Promise<void> = Promise.resolve();

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

    const key = String(userId);
    const existing = await DiscogsSyncReport.findOne({ user: userId });
    if (existing && activeUsers.has(key)) {
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
            $unset: { errorCode: '', finishedAt: '' }
        },
        { upsert: true, new: true }
    );

    activeUsers.add(key);
    queue = queue
        .then(() => runCheck(userId))
        .finally(() => { activeUsers.delete(key); });

    return report;
}

/** The user's latest check, or null if they never ran one. */
export async function getReport(userId: mongoose.Types.ObjectId): Promise<IDiscogsSyncReport | null> {
    const report = await DiscogsSyncReport.findOne({ user: userId });
    // A check that was queued or running when the server restarted would otherwise show "running" forever.
    if (report && (report.status === 'queued' || report.status === 'running') && !activeUsers.has(String(userId))) {
        report.status = 'error';
        report.errorCode = 'failed';
        report.finishedAt = new Date();
        await report.save();
    }
    return report;
}
