import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Config
import { connectDB } from "./config/database.config"
import { VERSION, NODE_ENV, COMMIT_SHA, IMAGE_TAG } from "./config/version.config"
import { logger } from "./config/logger.config"
import { ensureUploadDirs } from "./config/uploads.config"

// Routes
import usersRoute from "./routes/users.route"
import discogsRoute from './routes/discogs.route'
import authRoute from './routes/auth.route'
import collectionRoute from './routes/collection.route'
import publicRoute from './routes/public.route'
import preferencesRoute from './routes/preferences.route'
import adminRoute from './routes/admin.route'
import customFieldsRoute from './routes/customFields.route'
import systemRoute from './routes/system.route'
import discoverRoute from './routes/discover.route'

// Scripts
import { seedAdminUser } from "./scripts/seed"
import { runPendingMigrations } from "./scripts/migration-runner"
import { startTaskScheduler } from "./services/taskScheduler.service"

dotenv.config()

const bootStartedAt = Date.now();

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express()

// Identity first: this is what you look for when opening a container's logs.
logger.info(`Musivault API v${VERSION} (channel: ${IMAGE_TAG})`);
logger.info(`env=${NODE_ENV} commit=${COMMIT_SHA.substring(0, 7)} node=${process.version}`);

// Trust proxy setting for Docker environments (behind Nginx)
const trustProxy = process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true';
if (trustProxy) {
    app.set('trust proxy', 1);
}
logger.info(`trust proxy: ${trustProxy ? 'enabled' : 'disabled'}`);

const PORT = parseInt(process.env.PORT || '5001', 10);

// CORS configuration
const getCorsOrigins = (): string[] | true => {
    if (process.env.CORS_ORIGINS === '*') {
        return true as const;
    }
    if (process.env.NODE_ENV === 'production') {
        if (process.env.CORS_ORIGINS) {
            return process.env.CORS_ORIGINS.split(',').map(o => o.trim());
        }
        return true as const; // Default: allow all origins (Nginx proxy makes this safe)
    }
    if (process.env.CORS_ORIGINS) {
        return process.env.CORS_ORIGINS.split(',').map(o => o.trim());
    }
    return ['http://localhost:5173', 'http://localhost:3000'];
};

const corsOrigins = getCorsOrigins();
// Resolved rather than raw: getCorsOrigins branches on NODE_ENV, and this is
// the first thing worth checking when the frontend hits a CORS block.
logger.info(`cors origins: ${corsOrigins === true ? 'any' : corsOrigins.join(', ')}`);

app.use(cors({
    origin: corsOrigins === true
        ? true
        : (origin, callback) => {
            if (!origin) return callback(null, true);
            if (corsOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
    credentials: true
}))

app.use(express.json());
app.use(cookieParser())
app.use(helmet());

// Version middleware
app.use((req, res, next) => {
    res.setHeader('X-App-Version', VERSION);
    next();
});

// ============================================================================
// ROUTES
// ============================================================================

app.use('/api/users', usersRoute);
app.use('/api/discogs', discogsRoute);
app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
}), authRoute);
app.use('/api/collection', collectionRoute)
app.use('/api/public', publicRoute)
app.use('/api/discover', discoverRoute)
app.use('/api/preferences', preferencesRoute)
app.use('/api/custom-fields', customFieldsRoute)
app.use('/api/admin', adminRoute)

// Serve uploaded files (cover images for manual albums)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Version & health endpoints
app.use('/api', systemRoute);

// ============================================================================
// SERVER STARTUP & MIGRATIONS
// ============================================================================

ensureUploadDirs();

connectDB().then(async () => {
    // 1. Run all pending migrations automatically
    logger.info('running startup migrations...');
    await runPendingMigrations();

    // 2. Seeding
    await seedAdminUser();

    // 3. Start the background scheduler before listening. It logs on start, and
    //    doing it after app.listen() would print it *before* the ready line
    //    below, since that one runs in an async callback.
    startTaskScheduler();

    // 4. Accept traffic
    const server = app.listen(PORT, '0.0.0.0', () => {
        logger.info(`listening on 0.0.0.0:${PORT} - ready in ${Date.now() - bootStartedAt}ms`);
    });
    server.setTimeout(3600000); // 1 hour timeout for long imports
});