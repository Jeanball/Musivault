import axios from 'axios';
import { Request, Response } from 'express';
import User from '../models/User';
import { logger } from '../config/logger.config';
import { discogsRequest, hasPAT } from '../utils/discogs.utils';
import { decryptSecret, encryptSecret, hasEncryptionKey } from '../utils/crypto.utils';

interface DiscogsIdentity {
    username: string;
}

/** Ask Discogs who a token belongs to; this is also the check that the token works. */
async function fetchIdentity(token: string): Promise<DiscogsIdentity> {
    return discogsRequest<DiscogsIdentity>('/oauth/identity', {}, { token });
}

function isUnauthorized(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 401;
}

/**
 * Connection status for the Settings page. Never includes the token.
 * Re-checks a connected token with Discogs, so a revoked one shows up as
 * `needsReconnect` as soon as the user opens Settings. If Discogs can't be
 * reached, the stored state is returned unchanged.
 */
export async function getDiscogsAccount(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        // Without a key nothing can be stored, so the whole section stays hidden.
        if (!hasEncryptionKey()) {
            res.status(200).json({ available: false });
            return;
        }

        const user = await User.findById(req.user._id).select('+discogs.tokenEncrypted');
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const canUseServerAccount = user.isAdmin && hasPAT();
        const discogs = user.discogs;

        if (discogs) {
            try {
                const token = discogs.source === 'server'
                    ? process.env.DISCOGS_PAT
                    : discogs.tokenEncrypted && decryptSecret(discogs.tokenEncrypted);
                if (!token) {
                    throw new Error('No Discogs token available');
                }
                await fetchIdentity(token);
                discogs.needsReconnect = false;
            } catch (error) {
                if (isUnauthorized(error) || !axios.isAxiosError(error)) {
                    // 401 = revoked or regenerated. A non-HTTP error here means the stored token
                    // can't be used at all (key changed, PAT removed), which needs reconnecting too.
                    logger.warn({ err: error, userId: user.id }, 'Stored Discogs token is no longer usable');
                    discogs.needsReconnect = true;
                } else {
                    logger.warn({ err: error, userId: user.id }, 'Could not reach Discogs to verify the stored token');
                }
            }
            if (user.isModified('discogs.needsReconnect')) {
                await user.save();
            }
        }

        res.status(200).json({
            available: true,
            canUseServerAccount,
            connection: discogs ? {
                enabled: discogs.enabled,
                source: discogs.source,
                username: discogs.username,
                connectedAt: discogs.connectedAt,
                needsReconnect: discogs.needsReconnect
            } : null
        });
    } catch (error) {
        logger.error({ err: error }, 'Error in getDiscogsAccount');
        res.status(500).json({ message: 'Internal server error' });
    }
}

/**
 * Connect a Discogs account. Body is `{ source: 'server' }` (admins, needs `DISCOGS_PAT`)
 * or `{ source: 'own', token }`. The token is verified with Discogs before anything is stored,
 * then saved encrypted. Replaces any existing connection.
 */
export async function connectDiscogsAccount(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        if (!hasEncryptionKey()) {
            res.status(503).json({ message: 'Discogs accounts are not enabled on this server.' });
            return;
        }

        const { source, token } = req.body ?? {};

        let identity: DiscogsIdentity;
        let tokenEncrypted: string | undefined;

        try {
            if (source === 'server') {
                if (!req.user.isAdmin || !hasPAT()) {
                    res.status(403).json({ message: "The server's Discogs account is not available to you." });
                    return;
                }
                identity = await fetchIdentity(process.env.DISCOGS_PAT as string);
            } else if (source === 'own') {
                if (typeof token !== 'string' || !token.trim()) {
                    res.status(400).json({ message: 'A Discogs token is required.' });
                    return;
                }
                const trimmed = token.trim();
                identity = await fetchIdentity(trimmed);
                tokenEncrypted = encryptSecret(trimmed);
            } else {
                res.status(400).json({ message: "source must be 'server' or 'own'." });
                return;
            }
        } catch (error) {
            if (isUnauthorized(error)) {
                res.status(400).json({ message: 'Discogs rejected this token.' });
                return;
            }
            throw error;
        }

        await User.updateOne({ _id: req.user._id }, {
            $set: {
                discogs: {
                    enabled: true,
                    source,
                    username: identity.username,
                    ...(tokenEncrypted ? { tokenEncrypted } : {}),
                    connectedAt: new Date(),
                    needsReconnect: false
                }
            }
        });

        logger.info({ userId: req.user.id, source }, 'Discogs account connected');
        res.status(200).json({ enabled: true, source, username: identity.username, needsReconnect: false });
    } catch (error) {
        logger.error({ err: error }, 'Error in connectDiscogsAccount');
        res.status(500).json({ message: 'Could not connect to Discogs.' });
    }
}

/** Disconnect: removes the connection and the stored token. */
export async function disconnectDiscogsAccount(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        await User.updateOne({ _id: req.user._id }, { $unset: { discogs: '' } });

        logger.info({ userId: req.user.id }, 'Discogs account disconnected');
        res.status(200).json({ message: 'Disconnected' });
    } catch (error) {
        logger.error({ err: error }, 'Error in disconnectDiscogsAccount');
        res.status(500).json({ message: 'Internal server error' });
    }
}
