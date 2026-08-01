import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Application logger.
 *
 * JSON on stdout in production, which is what `docker logs` and any aggregator
 * expect. In development it goes through pino-pretty for readability — that
 * package is a devDependency, and the production image installs with
 * `npm ci --only=production`, so the transport must stay disabled there or the
 * container would fail to boot on a missing module.
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
    transport: isProduction
        ? undefined
        : {
              target: 'pino-pretty',
              options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss.l',
                  ignore: 'pid,hostname'
              }
          }
});
