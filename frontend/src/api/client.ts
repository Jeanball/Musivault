import axios from 'axios';
import { ApiError } from './errors';

/**
 * Endpoints where a 401 is a legitimate answer rather than an expired session:
 * - /auth/login and /auth/signup return 401 on bad credentials
 * - /auth/verify always answers 200 with { status: false }, but is listed for clarity
 * Redirecting on these would swallow the error message and loop back to /login.
 */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup', '/auth/verify'];

const isAuthEndpoint = (url: string | undefined): boolean =>
    !!url && AUTH_ENDPOINTS.some(endpoint => url.startsWith(endpoint));

/**
 * The app is always served same-origin: nginx proxies /api to the backend in
 * production, and the Vite dev server proxies it locally. No base URL env var.
 *
 * No global timeout on purpose — the CSV import can run for minutes and nginx
 * is configured with a 3600s read timeout to match.
 */
export const client = axios.create({
    baseURL: '/api',
    withCredentials: true
});

client.interceptors.response.use(
    response => response,
    error => {
        // A request the caller aborted is not a failure: rethrow it untouched so
        // callers can tell it apart from a real network error (which also has no
        // response) and skip their error handling entirely. Checked before
        // isAxiosError: isCancel's guard type ({ message?: string }) swallows
        // AxiosError, so testing it second narrows `error` to never.
        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }

        if (!axios.isAxiosError(error)) {
            return Promise.reject(
                new ApiError({ status: 0, message: String(error) })
            );
        }

        if (!error.response) {
            return Promise.reject(
                new ApiError({
                    status: 0,
                    message: error.message,
                    isNetworkError: true
                })
            );
        }

        const { status, data } = error.response;
        const serverMessage =
            typeof data === 'object' && data !== null && 'message' in data
                ? String((data as { message: unknown }).message)
                : undefined;

        // Session expired: send the user back to login instead of leaving the
        // UI in a broken state. Guarded so we never loop on /login itself.
        if (
            status === 401 &&
            !isAuthEndpoint(error.config?.url) &&
            window.location.pathname !== '/login'
        ) {
            window.location.href = '/login';
        }

        return Promise.reject(
            new ApiError({
                status,
                message: serverMessage || error.message,
                serverMessage
            })
        );
    }
);
