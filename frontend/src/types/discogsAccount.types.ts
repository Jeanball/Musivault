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

export interface DiscogsReportRelease {
    releaseId: number;
    instanceId: number;
    artist: string;
    title: string;
    year?: number;
    thumb?: string;
    format?: string;
    dateAdded: string;
}

export interface DiscogsReportItem {
    itemId: string;
    artist: string;
    title: string;
    year?: string;
    format?: string;
    discogsId?: number;
}

export interface DiscogsReportMerged {
    item: DiscogsReportItem;
    release: DiscogsReportRelease;
}

export interface DiscogsSyncReport {
    status: 'queued' | 'running' | 'completed' | 'error';
    errorCode?: 'needsReconnect' | 'failed';
    startedAt: string;
    finishedAt?: string;
    progress: { page: number; pages: number };
    username: string;
    counts: {
        discogs: number;
        matched: number;
        newOnDiscogs: number;
        merged: number;
        onlyInMusivault: number;
        dateDiffers: number;
    };
    newOnDiscogs: DiscogsReportRelease[];
    merged: DiscogsReportMerged[];
    onlyInMusivault: DiscogsReportItem[];
}
