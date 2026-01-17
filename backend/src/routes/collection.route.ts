import { Router } from 'express';
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
    rematchAlbum,
    getStyles,
    addManualAlbum
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
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
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

// Manual album entry (must be before /:itemId to avoid route conflicts)
router.post('/manual', protectRoute, coverUpload.single('cover'), addManualAlbum);

// Collection CRUD
router.post('/', protectRoute, addToCollection);
router.get('/', protectRoute, getMyCollection);
router.get('/:itemId', protectRoute, getCollectionItemById);
router.put('/:itemId', protectRoute, updateCollectionItem);
router.post('/:itemId/rematch', protectRoute, rematchAlbum);
router.delete('/:itemId', protectRoute, deleteFromCollection);

export default router;