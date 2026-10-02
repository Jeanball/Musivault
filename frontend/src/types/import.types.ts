export interface ImportLogEntry {
    rowIndex: number;
    inputArtist: string;
    inputAlbum: string;
    inputYear?: string;
    inputFormat: string;
    inputReleaseId?: string;
    inputCatalogNumber?: string;
    matchedArtist?: string;
    matchedAlbum?: string;
    matchedYear?: string;
    discogsId?: number;
    matchMethod?: 'releaseId' | 'catalogNumber' | 'search';
    status: 'success' | 'failed' | 'skipped';
    reason?: string;
}

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ImportLog {
    _id: string;
    importedAt: string;
    fileName?: string;
    totalRows: number;
    successCount: number;
    failCount: number;
    skipCount: number;
    status: ImportStatus;
    entries: ImportLogEntry[];
}

/** Answer to POST /api/collection/import — the import then runs in background. */
export interface ImportStarted {
    totalRows: number;
    logId: string;
}
