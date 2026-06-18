import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
    addToCollection,
    getMyCollection,
    getCollectionItemById,
    deleteFromCollection,
    importCollectionCSV,
    downloadTemplate,
    getImportLogs,
    getImportLogById,
    downloadImportLog,
    updateCollectionItem,
    ignoreFormatVerificationAlert,
    restoreFormatVerificationAlert,
    rematchAlbum,
    getStyles,
    addManualAlbum,
    getCollectionSyncInfo,
    syncItemPrice
} from '../controllers/collection.controller';
import protectRoute from '../middlewares/protectRoute.middleware';

const router = Router();

// CSV import storage (in memory)
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Cover image storage (on disk)
const uploadsDir = path.join(__dirname, '../../uploads/covers');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const coverUpload = multer({
    storage: coverStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
        }
    }
});

// CSV import endpoints (must be before /:itemId to avoid route conflicts)
router.get('/template', protectRoute, downloadTemplate);
router.post('/import', protectRoute, csvUpload.single('file'), importCollectionCSV);
router.get('/import/logs', protectRoute, getImportLogs);
router.get('/import/logs/:logId', protectRoute, getImportLogById);
router.get('/import/logs/:logId/download', protectRoute, downloadImportLog);

// Style filter endpoint (must be before /:itemId to avoid route conflicts)
router.get('/styles', protectRoute, getStyles);
router.get('/sync-info', protectRoute, getCollectionSyncInfo);

// Manual album entry (must be before /:itemId to avoid route conflicts)
// Wrap with error handler to catch MulterError (file too large, wrong type, etc.)
router.post('/manual', protectRoute, (req: Request, res: Response, next: NextFunction) => {
    coverUpload.single('cover')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            console.warn(`[ManualAlbum] Multer error: ${err.code} - ${err.message} (field: ${err.field})`);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ message: 'Cover image is too large. Maximum size is 5 MB.' });
            }
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        }
        if (err) {
            console.warn(`[ManualAlbum] Upload error: ${err.message}`);
            return res.status(400).json({ message: err.message || 'Invalid file upload' });
        }
        next();
    });
}, addManualAlbum);

// Collection CRUD
// Collection CRUD
router.post('/', protectRoute, addToCollection);
router.get('/', protectRoute, getMyCollection);
router.get('/:itemId', protectRoute, getCollectionItemById);
router.put('/:itemId', protectRoute, updateCollectionItem);
router.post('/:itemId/ignore-format-alert', protectRoute, ignoreFormatVerificationAlert);
router.post('/:itemId/restore-format-alert', protectRoute, restoreFormatVerificationAlert);
router.post('/:itemId/sync-price', protectRoute, syncItemPrice);
router.post('/:itemId/rematch', protectRoute, rematchAlbum);
router.delete('/:itemId', protectRoute, deleteFromCollection);

export default router;
