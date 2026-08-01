import fs from 'fs';
import path from 'path';

// Read version from environment variable (Docker) or VERSION file (development)
const getVersion = (): string => {
    // In Docker, APP_VERSION is set as an environment variable during build
    if (process.env.APP_VERSION) {
        return process.env.APP_VERSION;
    }

    // In development, read from VERSION file.
    // Paths are relative to src/config (or dist/config once compiled), so '../..'
    // is the backend root and '../../..' is the project root where VERSION lives.
    try {
        const versionPath = path.join(__dirname, '../..', 'VERSION');
        return fs.readFileSync(versionPath, 'utf-8').trim();
    } catch {
        try {
            const versionPath = path.join(__dirname, '../../..', 'VERSION');
            return fs.readFileSync(versionPath, 'utf-8').trim();
        } catch {
            console.warn('Could not read VERSION file, using default');
            return '0.0.0-dev';
        }
    }
};

export const VERSION = getVersion();
export const BUILD_DATE = process.env.BUILD_DATE || new Date().toISOString();
export const COMMIT_SHA = process.env.COMMIT_SHA || 'dev';
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IMAGE_TAG = process.env.IMAGE_TAG || 'dev'; // Release channel: nightly, beta, latest, or dev
