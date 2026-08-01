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
            'req.headers.authorization'
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
