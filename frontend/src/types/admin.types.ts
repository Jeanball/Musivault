export interface AdminUser {
    _id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    createdAt: string;
    lastAlbumAdded?: string;
    albumCount?: number;
    isPublic: boolean;
    publicShareId: string;
}

export interface AdminTask {
    id: string;
    intervalLabel: string;
    nextExecutionAt: string | null;
    lastExecutionAt: string | null;
    lastDurationMs: number | null;
    lastStatus: 'success' | 'failed' | null;
}
