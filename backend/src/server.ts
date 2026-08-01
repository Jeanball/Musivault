import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Config
import { connectDB } from "./config/database.config"
import { VERSION, NODE_ENV, COMMIT_SHA } from "./config/version.config"
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

// Scripts
import { seedAdminUser } from "./scripts/seed"
import { runPendingMigrations } from "./scripts/migration-runner"
import { startTaskScheduler } from "./services/taskScheduler.service"

dotenv.config()

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express()

// Trust proxy setting for Docker environments (behind Nginx)
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

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
    console.log('Running startup migrations...');
    await runPendingMigrations();

    // 2. Seeding
    await seedAdminUser();

    // 3. Start Server
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log("=================================");
        console.log(`🚀 Musivault API v${VERSION}`);
        console.log(`📡 Server running on PORT: ${PORT}`);
        console.log(`🌍 Environment: ${NODE_ENV}`);
        console.log(`📦 Commit: ${COMMIT_SHA.substring(0, 7)}`);
        console.log("=================================");
    });
    server.setTimeout(3600000); // 1 hour timeout for long imports

    // 4. Start background task scheduler
    startTaskScheduler();
});