const DEV_DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

/**
 * The origins the API accepts, from `CORS_ORIGINS` and `NODE_ENV`: `true` for any,
 * otherwise an explicit list. `CORS_ORIGINS=*` means any; in production without
 * `CORS_ORIGINS` it is any too (the reverse proxy makes that safe); in
 * development without it, it is the Vite and Docker dev ports on localhost.
 */
export function getCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] | true {
    if (env.CORS_ORIGINS === '*') {
        return true;
    }
    if (env.CORS_ORIGINS) {
        return env.CORS_ORIGINS.split(',').map(o => o.trim());
    }
    if (env.NODE_ENV === 'production') {
        return true;
    }
    return DEV_DEFAULT_ORIGINS;
}

/**
 * Whether development, with no explicit `CORS_ORIGINS`, also accepts loopback and
 * private-network origins. Vite's `--host` prints a LAN URL and Vite moves to the
 * next port when 5173 is taken, so a fixed list rejects both. An explicit
 * `CORS_ORIGINS` and production keep exactly what they list.
 */
export function allowsLocalNetworkOrigins(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.NODE_ENV !== 'production' && !env.CORS_ORIGINS;
}

/**
 * True for an http(s) origin whose host is loopback (`localhost`, `127.0.0.0/8`,
 * `[::1]`, `0.0.0.0`) or a private IPv4 address (10/8, 172.16/12, 192.168/16),
 * on any port. Anything else, including public hosts that merely look similar
 * (`localhost.example.com`, `192.168.1.1.example.com`), is false.
 */
export function isLocalNetworkOrigin(origin: string): boolean {
    let url: URL;
    try {
        url = new URL(origin);
    } catch {
        return false;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return false;
    }

    const host = url.hostname;
    if (host === 'localhost' || host === '[::1]' || host === '0.0.0.0') {
        return true;
    }

    const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!match) {
        return false;
    }
    const [a, b, c, d] = match.slice(1).map(Number);
    if ([a, b, c, d].some(part => part > 255)) {
        return false;
    }
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
