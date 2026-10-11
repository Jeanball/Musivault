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
    mediaCondition?: string;
    sleeveCondition?: string;
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
    /** `instance`: the item's stored Discogs entry moved to this release (exact). `guess`: paired by artist, title, format and year. */
    match: 'instance' | 'guess';
}

export interface DiscogsApplyFailure {
    kind: 'add' | 'relink';
    artist: string;
    title: string;
    releaseId: number;
    reason: string;
}

export interface DiscogsApply {
    status: 'queued' | 'running' | 'completed' | 'error';
    errorCode?: 'needsReconnect' | 'failed';
    phase: 'collection' | 'records' | 'dates';
    startedAt: string;
    finishedAt?: string;
    total: number;
    done: number;
    added: number;
    relinked: number;
    skipped: number;
    failed: number;
    useDiscogsDates: boolean;
    datesUpdated: number;
    instanceIdsStored: number;
    failures: DiscogsApplyFailure[];
}

/** What to apply: the rows the user ticked, and whether to take the dates added from Discogs. */
export interface DiscogsApplySelection {
    add: number[];
    relink: { itemId: string; releaseId: number }[];
    useDiscogsDates: boolean;
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
    apply?: DiscogsApply;
}
