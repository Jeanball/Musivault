export interface DiscogsConnection {
    enabled: boolean;
    source: 'server' | 'own';
    username: string;
    connectedAt: string;
    /** Discogs no longer accepts the stored token. */
    needsReconnect: boolean;
}

export type DiscogsAccountStatus =
    | { available: false }
    | { available: true; canUseServerAccount: boolean; connection: DiscogsConnection | null };
