import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

import { connectDB } from "./config/database.config"
import { seedAdminUser } from "./scripts/seed"

import usersRoute from "./routes/users.route"
import discogsRoute from './routes/discogs.route'
import authRoute from './routes/auth.route'
import collectionRoute from './routes/collection.route'
import publicRoute from './routes/public.route'
dotenv.config()

// Read version from environment variable (Docker) or VERSION file (development)
const getVersion = (): string => {
    // In Docker, APP_VERSION is set as an environment variable during build
    if (process.env.APP_VERSION) {
        return process.env.APP_VERSION;
    }

    // In development, read from VERSION file
    try {
        const versionPath = path.join(__dirname, '..', 'VERSION');
        return fs.readFileSync(versionPath, 'utf-8').trim();
    } catch {
        try {
            // Try one more level up (from src/server.ts)
            const versionPath = path.join(__dirname, '../..', 'VERSION');
            return fs.readFileSync(versionPath, 'utf-8').trim();
        } catch {
            console.warn('Could not read VERSION file, using default');
            return '0.0.0-dev';
        }
    }
};

const VERSION = getVersion();
const BUILD_DATE = process.env.BUILD_DATE || new Date().toISOString();
const COMMIT_SHA = process.env.COMMIT_SHA || 'dev';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IMAGE_TAG = process.env.IMAGE_TAG || 'dev'; // Release channel: nightly, beta, latest, or dev

const app = express()

// Trust proxy setting for Docker environments (behind Nginx)
// Required for express-rate-limit to work correctly with X-Forwarded-For headers
// Enable in production OR when TRUST_PROXY is explicitly set (for Docker dev)
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

const PORT = parseInt(process.env.PORT || '5001', 10);
// CORS configuration
// In Docker production: Nginx proxies /api requests, so browser sees same-origin (no CORS needed)
// For flexibility, users can set CORS_ORIGINS env var with comma-separated origins or * for all
const getCorsOrigins = (): string[] | true => {
    // Check if CORS_ORIGINS is explicitly set to allow all
    if (process.env.CORS_ORIGINS === '*') {
        return true as const;
    }

    // In production with Docker, allow all origins since Nginx handles proxying
    if (process.env.NODE_ENV === 'production') {
        // If user wants to restrict origins, they can set CORS_ORIGINS
        if (process.env.CORS_ORIGINS) {
            return process.env.CORS_ORIGINS.split(',').map(o => o.trim());
        }
        // Default: allow all origins (Nginx proxy makes this safe)
        return true as const;
    }

    // Development mode: use CORS_ORIGINS if set, otherwise default to localhost
    if (process.env.CORS_ORIGINS) {
        return process.env.CORS_ORIGINS.split(',').map(o => o.trim());
    }
    return ['http://localhost:5173', 'http://localhost:3000'];
};

const corsOrigins = getCorsOrigins();

app.use(cors({
    origin: corsOrigins === true
        ? true  // Allow all origins
        : (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
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

app.use('/api/users', usersRoute);
app.use('/api/discogs', discogsRoute);
app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
}), authRoute);
app.use('/api/collection', collectionRoute)
app.use('/api/public', publicRoute)

// Serve uploaded files (cover images for manual albums)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Version middleware - adds version header to all responses
app.use((req, res, next) => {
    res.setHeader('X-App-Version', VERSION);
    next();
});

// Version endpoint
app.get('/api/version', (req, res) => {
    res.status(200).json({
        version: VERSION,
        channel: IMAGE_TAG,
        buildDate: BUILD_DATE,
        commitSha: COMMIT_SHA,
        environment: NODE_ENV
    });
});

// Health check endpoint for Docker (enhanced with version)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        version: VERSION,
        timestamp: new Date().toISOString()
    });
});


connectDB().then(async () => {
    // Seed admin user if ADMIN_* env vars are set and no admin exists
    await seedAdminUser();

    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log("=================================");
        console.log(`🚀 Musivault API v${VERSION}`);
        console.log(`📡 Server running on PORT: ${PORT}`);
        console.log(`🌍 Environment: ${NODE_ENV}`);
        console.log(`📦 Commit: ${COMMIT_SHA.substring(0, 7)}`);
        console.log("=================================");
    });
    server.setTimeout(3600000); // 1 hour timeout for long imports
});