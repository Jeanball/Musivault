import { Request, Response } from 'express';
import * as client from 'openid-client';
import { getOIDCConfig, getOIDCRedirectUri, isOIDCEnabled } from '../config/oidc.config';
import User from '../models/User';
import { generateToken } from '../utils/SecretToken';

// Validate and get frontend URL to prevent open redirect
function getSafeFrontendUrl(): string {
    const url = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
        const parsed = new URL(url);
        // Only allow http/https protocols
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            console.warn('Invalid FRONTEND_URL protocol, using default');
            return 'http://localhost:5173';
        }
        return url;
    } catch {
        console.warn('Invalid FRONTEND_URL, using default');
        return 'http://localhost:5173';
    }
}

// In-memory store for state/nonce (use Redis in production for multi-instance deployments)
const pendingAuth = new Map<string, { nonce: string; codeVerifier: string }>();

export async function initiateOIDCLogin(req: Request, res: Response) {
    try {
        if (!isOIDCEnabled()) {
            res.status(400).json({ message: 'OIDC is not configured on this server.' });
            return;
        }

        const config = await getOIDCConfig();
        const redirectUri = getOIDCRedirectUri();

        // Generate PKCE code verifier and state
        const codeVerifier = client.randomPKCECodeVerifier();
        const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
        const state = client.randomState();
        const nonce = client.randomNonce();

        // Store for callback verification
        pendingAuth.set(state, { nonce, codeVerifier });

        // Clean up old entries after 10 minutes
        setTimeout(() => pendingAuth.delete(state), 10 * 60 * 1000);

        const authorizationUrl = client.buildAuthorizationUrl(config, {
            redirect_uri: redirectUri,
            scope: 'openid email profile',
            state,
            nonce,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        res.redirect(authorizationUrl.href);
    } catch (error) {
        console.error('Error initiating OIDC login:', error);
        res.status(500).json({ message: 'Failed to initiate OIDC login.' });
    }
}

export async function handleOIDCCallback(req: Request, res: Response) {
    try {
        if (!isOIDCEnabled()) {
            res.status(400).json({ message: 'OIDC is not configured on this server.' });
            return;
        }

        const config = await getOIDCConfig();
        const redirectUri = getOIDCRedirectUri();

        // Get state from query params
        const state = req.query.state as string;
        if (!state || !pendingAuth.has(state)) {
            res.status(400).json({ message: 'Invalid or expired authentication state.' });
            return;
        }

        const { nonce, codeVerifier } = pendingAuth.get(state)!;
        pendingAuth.delete(state);

        // Build the current URL for token exchange
        const currentUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);

        // Exchange code for tokens
        const tokens = await client.authorizationCodeGrant(config, currentUrl, {
            pkceCodeVerifier: codeVerifier,
            expectedNonce: nonce,
            expectedState: state,
        });

        // Get user info from tokens
        const claims = tokens.claims();
        if (!claims) {
            res.status(400).json({ message: 'Failed to get user claims from OIDC provider.' });
            return;
        }

        const sub = claims.sub;
        const email = claims.email as string | undefined;
        const name = (claims.name || claims.preferred_username || email?.split('@')[0] || 'User') as string;

        if (!email) {
            res.status(400).json({ message: 'Email not provided by OIDC provider. Please ensure your IdP shares the email claim.' });
            return;
        }

        // Find or create user
        let user = await User.findOne({
            $or: [
                { authProvider: 'oidc', authId: sub },
                { email: email.toLowerCase() }
            ]
        });

        if (user) {
            // Update existing user with OIDC info if they were local
            if (user.authProvider === 'local') {
                user.authProvider = 'oidc';
                user.authId = sub;
            }
            user.lastLogin = new Date();
            await user.save();
        } else {
            // Create new OIDC user
            user = new User({
                username: name,
                email: email.toLowerCase(),
                authProvider: 'oidc',
                authId: sub,
                lastLogin: new Date()
            });
            await user.save();
        }

        // Generate JWT token
        const token = generateToken(user.id.toString());

        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 15 * 24 * 60 * 60 * 1000
        });

        // Redirect to frontend
        const frontendUrl = getSafeFrontendUrl();
        res.redirect(`${frontendUrl}/app`);
    } catch (error) {
        console.error('Error handling OIDC callback:', error);
        const frontendUrl = getSafeFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=oidc_failed`);
    }
}

export async function getOIDCStatus(req: Request, res: Response) {
    res.json({ enabled: isOIDCEnabled() });
}
