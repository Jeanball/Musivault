import axios from 'axios';

/**
 * Normalized error thrown by every call made through the API client.
 * Components branch on `status` instead of digging through axios internals,
 * and translate `message` themselves so i18n stays in the component layer.
 */
export class ApiError extends Error {
    readonly status: number;
    /** Message sent by the backend, when it provided one. */
    readonly serverMessage?: string;
    /** True when the request never reached the server (offline, DNS, CORS). */
    readonly isNetworkError: boolean;

    constructor(params: {
        status: number;
        message: string;
        serverMessage?: string;
        isNetworkError?: boolean;
    }) {
        super(params.message);
        this.name = 'ApiError';
        this.status = params.status;
        this.serverMessage = params.serverMessage;
        this.isNetworkError = params.isNetworkError ?? false;
    }
}

export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

/**
 * True when Discogs' rate limit was hit. The backend passes the 429 straight
 * through, so this is a temporary throttle rather than a real failure — callers
 * should let the user retry in place instead of navigating away.
 */
export function isRateLimitError(error: unknown): boolean {
    return isApiError(error) && error.status === 429;
}

/**
 * True when the caller aborted the request itself (a superseded search, an
 * unmounted component). Never surface these to the user.
 */
export function isCanceledError(error: unknown): boolean {
    return axios.isCancel(error);
}
