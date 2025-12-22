import * as client from 'openid-client';

let oidcConfig: client.Configuration | null = null;

export function isOIDCEnabled(): boolean {
    return !!(
        process.env.OIDC_ISSUER &&
        process.env.OIDC_CLIENT_ID &&
        process.env.OIDC_CLIENT_SECRET
    );
}

export async function getOIDCConfig(): Promise<client.Configuration> {
    if (oidcConfig) {
        return oidcConfig;
    }

    const issuer = process.env.OIDC_ISSUER;
    const clientId = process.env.OIDC_CLIENT_ID;
    const clientSecret = process.env.OIDC_CLIENT_SECRET;

    if (!issuer || !clientId || !clientSecret) {
        throw new Error('OIDC configuration is incomplete. Please set OIDC_ISSUER, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET.');
    }

    oidcConfig = await client.discovery(
        new URL(issuer),
        clientId,
        clientSecret
    );

    return oidcConfig;
}

export function getOIDCRedirectUri(): string {
    const redirectUri = process.env.OIDC_REDIRECT_URI;
    if (!redirectUri) {
        throw new Error('OIDC_REDIRECT_URI is not configured.');
    }
    return redirectUri;
}
