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
