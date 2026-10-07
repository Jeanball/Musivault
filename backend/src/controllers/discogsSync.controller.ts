import { Request, Response } from 'express';
import { logger } from '../config/logger.config';
import { DiscogsCheckError, getReport, startCheck } from '../services/discogsSync.service';

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
