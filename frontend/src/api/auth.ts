import { client } from './client';
import type {
    VerificationResponse,
    LoginResponse,
    SignupResponse,
    OidcStatus
} from '../types/auth.types';

/**
 * Never rejects on a bad session — the backend answers 200 with
 * { status: false }. Callers must check `status` themselves.
 */
export async function verify(): Promise<VerificationResponse> {
    const { data } = await client.post<VerificationResponse>('/auth/verify', {});
    return data;
}

/** Rejects with an ApiError of status 401 when credentials are wrong. */
export async function login(credentials: {
    identifier: string;
    password: string;
}): Promise<LoginResponse> {
    const { data } = await client.post<LoginResponse>('/auth/login', credentials);
    return data;
}

export async function signup(payload: {
    email: string;
    password: string;
    username: string;
}): Promise<SignupResponse> {
    const { data } = await client.post<SignupResponse>('/auth/signup', payload);
    return data;
}

export async function logout(): Promise<void> {
    await client.post('/auth/logout', {});
}

export async function getOidcStatus(): Promise<OidcStatus> {
    const { data } = await client.get<OidcStatus>('/auth/oidc/status');
    return data;
}

/**
 * Full-page navigation target, not an XHR — the OIDC provider redirects the
 * browser back to our callback, so this must leave the SPA.
 */
export const OIDC_LOGIN_URL = '/api/auth/oidc/login';
