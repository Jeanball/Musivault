/**
 * POST /api/auth/verify always answers 200; `status` is the discriminator.
 * The remaining fields are only present when status is true.
 */
export interface VerificationResponse {
    status: boolean;
    user: string;
    userId: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
}

export interface LoginResponse {
    _id: string;
    username: string;
    email: string;
}

export interface SignupResponse {
    success: boolean;
    message: string;
}

/** GET /api/auth/config: public, tells the login screens what the server allows. */
export interface AuthConfig {
    signupEnabled: boolean;
    oidcEnabled: boolean;
    oidcProviderName: string;
}

export interface PrivateOutletContext {
    username: string;
    email: string;
    displayName: string;
    userId: string;
    isAdmin: boolean;
    refreshUser: () => Promise<void>;
}
