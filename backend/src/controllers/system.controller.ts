import { Request, Response } from 'express';
import { VERSION, BUILD_DATE, COMMIT_SHA, NODE_ENV, IMAGE_TAG } from '../config/version.config';

export const getVersionInfo = (req: Request, res: Response) => {
    res.status(200).json({
        version: VERSION,
        channel: IMAGE_TAG,
        buildDate: BUILD_DATE,
        commitSha: COMMIT_SHA,
        environment: NODE_ENV
    });
};

export const getHealth = (req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        version: VERSION,
        timestamp: new Date().toISOString()
    });
};
