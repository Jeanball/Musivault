import { Request, Response } from 'express';
import { logger } from '../config/logger.config';
import mongoose from 'mongoose';
import { DiscogsApplyError, startApply } from '../services/discogsApply.service';
import { DiscogsCheckError, getPendingSummary, getReport, startCheck } from '../services/discogsSync.service';

/** Start a read-only check against the user's Discogs collection. Replies 202; poll `getDiscogsReport`. */
export async function startDiscogsCheck(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const report = await startCheck(req.user._id);
        res.status(202).json({ status: report.status });
    } catch (error) {
        if (error instanceof DiscogsCheckError) {
            res.status(error.code === 'needsReconnect' ? 409 : 400).json({ code: error.code, message: error.message });
            return;
        }
        logger.error({ err: error }, 'Error in startDiscogsCheck');
        res.status(500).json({ message: 'Internal server error' });
    }
}

/** The user's latest check report: progress while it runs, the full result when it is done. `report` is null before the first check. */
export async function getDiscogsReport(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const report = await getReport(req.user._id);
        res.status(200).json({ report: report ? report.toObject({ versionKey: false }) : null });
    } catch (error) {
        logger.error({ err: error }, 'Error in getDiscogsReport');
        res.status(500).json({ message: 'Internal server error' });
    }
}

const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

/**
 * Start applying what the user ticked in the last check: `{ add: releaseId[], relink: { itemId, releaseId }[],
 * useDiscogsDates: boolean }`. Replies 202; poll `getDiscogsReport` and read `apply`.
 * 400 for a malformed or empty selection, no account or no check; 409 when the token needs reconnecting
 * or another Discogs job is running.
 */
export async function startDiscogsApply(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const { add = [], relink = [], useDiscogsDates = false } = req.body ?? {};
        const valid = Array.isArray(add) && add.every(isId)
            && Array.isArray(relink) && relink.every(r => r && mongoose.isValidObjectId(r.itemId) && isId(r.releaseId))
            && typeof useDiscogsDates === 'boolean';
        if (!valid) {
            res.status(400).json({ code: 'invalid', message: 'Invalid selection.' });
            return;
        }

        await startApply(req.user._id, {
            add: [...new Set<number>(add)],
            relink: relink.map((r: { itemId: string; releaseId: number }) => ({ itemId: String(r.itemId), releaseId: r.releaseId })),
            useDiscogsDates
        });
        res.status(202).json({ status: 'queued' });
    } catch (error) {
        if (error instanceof DiscogsApplyError) {
            const conflict = error.code === 'needsReconnect' || error.code === 'busy';
            res.status(conflict ? 409 : 400).json({ code: error.code, message: error.message });
            return;
        }
        logger.error({ err: error }, 'Error in startDiscogsApply');
        res.status(500).json({ message: 'Internal server error' });
    }
}

/** What the last check left to act on (`summary` is null when there is nothing to show). Cheap: no report rows. */
export async function getDiscogsSummary(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        res.status(200).json({ summary: await getPendingSummary(req.user) });
    } catch (error) {
        logger.error({ err: error }, 'Error in getDiscogsSummary');
        res.status(500).json({ message: 'Internal server error' });
    }
}
