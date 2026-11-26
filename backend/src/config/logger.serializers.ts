import pino from 'pino';

const SECRET_PARAMS = /^(key|secret|token|apikey|api_key|access_token|client_secret|consumer_key|consumer_secret|password)$/i;
const MAX_BODY_LOG = 500;

/**
 * Copies a query-parameter object with credential values replaced, so the
 * remaining parameters (search terms, paging) stay useful in the logs.
 */
function redactParams(params: unknown): Record<string, unknown> | undefined {
    if (!params || typeof params !== 'object') return undefined;
    return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, SECRET_PARAMS.test(k) ? '[redacted]' : v]));
}

/**
 * Returns the URL with credential query parameters replaced, never throwing:
 * an unparseable value is cut at the first "?" instead.
 */
export function redactUrl(url: unknown): string | undefined {
    if (typeof url !== 'string') return undefined;
    try {
        const parsed = new URL(url, 'http://placeholder.invalid');
        for (const name of [...parsed.searchParams.keys()]) {
            if (SECRET_PARAMS.test(name)) parsed.searchParams.set(name, '[redacted]');
        }
        const text = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
        return decodeURIComponent(text);
    } catch {
        return url.split('?')[0];
    }
}

/**
 * Serializer for the `err` key of every log call.
 *
 * Axios errors carry the whole request on them: the URL with the Discogs key
 * and secret in its query string, the raw request headers, and the TLS socket.
 * Pino's default serializer prints all of it, and a plain redact path cannot
 * keep up because the location of the request object has moved between axios
 * releases. So axios errors are reduced to an allow-list instead (status,
 * method, redacted URL and params, a short response body). Other errors go
 * through pino's standard serializer unchanged.
 */
export function serializeError(err: unknown): unknown {
    const base = pino.stdSerializers.err(err as Error);
    const axiosError = err as {
        isAxiosError?: boolean;
        code?: string;
        config?: { method?: string; baseURL?: string; url?: string; params?: unknown };
        response?: { status?: number; data?: unknown };
    } | null;
    if (!axiosError || axiosError.isAxiosError !== true) return base;

    const body = axiosError.response?.data;
    const bodyText = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) ?? undefined;
    return {
        type: base.type,
        message: base.message,
        stack: base.stack,
        code: axiosError.code,
        status: axiosError.response?.status,
        method: axiosError.config?.method?.toUpperCase(),
        url: redactUrl(`${axiosError.config?.baseURL ?? ''}${axiosError.config?.url ?? ''}`),
        params: redactParams(axiosError.config?.params),
        responseBody: bodyText && bodyText.length > MAX_BODY_LOG ? `${bodyText.slice(0, MAX_BODY_LOG)}…` : bodyText
    };
}
