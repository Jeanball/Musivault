import pino from 'pino';

/**
 * Application logger.
 *
 * Output always goes through pino-pretty so `docker logs` is readable in every
 * environment; that means the package is a regular dependency, since the
 * production image installs with `npm ci --only=production`.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    // Never let credentials reach the logs, whatever gets passed in.
    redact: {
        paths: [
            'MONGO_URI',
            'JWT_SECRET',
            'SESSION_SECRET',
            'DISCOGS_SECRET',
            'DISCOGS_PAT',
            'OIDC_CLIENT_SECRET',
            'ADMIN_PASSWORD',
            'password',
            'req.headers.cookie',
            'req.headers.authorization',
            // Axios serializes the whole request config onto the error, so a
            // failed Discogs call would otherwise print the PAT in the headers
            // and the key/secret in the query params on every 429.
            'err.config.headers.Authorization',
            'err.config.headers.authorization',
            'err.config.params.key',
            'err.config.params.secret',
            'err.config.params.token',
            '*.config.headers.Authorization',
            '*.config.headers.authorization',
            '*.config.params.key',
            '*.config.params.secret',
            '*.config.params.token'
        ],
        censor: '[redacted]'
    },
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname'
        }
    }
});
