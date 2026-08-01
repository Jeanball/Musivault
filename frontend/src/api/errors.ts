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
