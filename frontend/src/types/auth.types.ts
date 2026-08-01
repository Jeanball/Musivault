export interface PrivateOutletContext {
    username: string;
    email: string;
    displayName: string;
    userId: string;
    isAdmin: boolean;
    refreshUser: () => Promise<void>;
}
