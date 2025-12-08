import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

import { connectDB } from "./config/db"
import { seedAdminUser } from "./config/seed"

import usersRoute from "./routes/users.route"
import discogsRoute from './routes/discogs.route'
import authRoute from './routes/auth.route'
import collectionRoute from './routes/collection.route'
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

const app = express()
const PORT = parseInt(process.env.PORT || '5001', 10);
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['http://localhost:3000', 'http://localhost']
    : ['http://localhost:5173', 'http://10.0.0.153:5173', 'http://localhost:3000', 'http://10.0.0.153:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'production') {
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

// Version middleware - adds version header to all responses
app.use((req, res, next) => {
    res.setHeader('X-App-Version', VERSION);
    next();
});

// Version endpoint
app.get('/api/version', (req, res) => {
    res.status(200).json({
        version: VERSION,
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

    app.listen(PORT, '0.0.0.0', () => {
        console.log("=================================");
        console.log(`🚀 Musivault API v${VERSION}`);
        console.log(`📡 Server running on PORT: ${PORT}`);
        console.log(`🌍 Environment: ${NODE_ENV}`);
        console.log(`📦 Commit: ${COMMIT_SHA.substring(0, 7)}`);
        console.log("=================================");
    });
});