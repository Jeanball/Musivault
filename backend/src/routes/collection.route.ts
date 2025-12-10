import { Router } from 'express';
import multer from 'multer';
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
    updateCollectionItem
} from '../controllers/collection.controller';
import protectRoute from '../middlewares/protectRoute';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// CSV import endpoints (must be before /:itemId to avoid route conflicts)
router.get('/template', protectRoute, downloadTemplate);
router.post('/import', protectRoute, upload.single('file'), importCollectionCSV);
router.get('/import/logs', protectRoute, getImportLogs);
router.get('/import/logs/:logId', protectRoute, getImportLogById);
router.get('/import/logs/:logId/download', protectRoute, downloadImportLog);

// Collection CRUD
router.post('/', protectRoute, addToCollection);
router.get('/', protectRoute, getMyCollection);
router.get('/:itemId', protectRoute, getCollectionItemById);
router.put('/:itemId', protectRoute, updateCollectionItem);
router.delete('/:itemId', protectRoute, deleteFromCollection);

export default router;