import fs from 'fs';
import path from 'path';

// Resolves to backend/uploads/covers from either src/config or dist/config
export const COVERS_DIR = path.join(__dirname, '../../uploads/covers');

/**
 * Create the upload directories if they don't exist yet.
 * Called once at server startup rather than as a module import side effect.
 */
export const ensureUploadDirs = (): void => {
    if (!fs.existsSync(COVERS_DIR)) {
        fs.mkdirSync(COVERS_DIR, { recursive: true });
    }
};
