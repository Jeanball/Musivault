import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { COVERS_DIR } from '../config/uploads.config';
import { logger } from '../config/logger.config';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// CSV import storage (in memory)
export const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE }
});

// Cover image storage (on disk)
const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, COVERS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const coverUpload = multer({
    storage: coverStorage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
        }
    }
});

/**
 * Accepts a single 'cover' image upload, mapping MulterError to a proper
 * status code (413 for oversized files, 400 otherwise) instead of letting it
 * bubble up as a generic 500.
 */
export const uploadCover = (req: Request, res: Response, next: NextFunction) => {
    coverUpload.single('cover')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            logger.warn({ err }, `[ManualAlbum] Multer error: ${err.code} (field: ${err.field})`);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ message: 'Cover image is too large. Maximum size is 5 MB.' });
            }
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        if (err) {
            logger.warn({ err }, "[ManualAlbum] Upload error");
            return res.status(400).json({ message: err.message || 'Invalid file upload' });
        }
        next();
    });
};
