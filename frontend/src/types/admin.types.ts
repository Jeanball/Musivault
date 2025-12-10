export interface AdminUser {
    _id: string;
    username: string;
    email: string;
    isAdmin: boolean;
    createdAt: string;
    lastLogin?: string;
    albumCount?: number;
}
