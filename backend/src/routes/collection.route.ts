import { Router } from 'express';
import {
    addToCollection,
    getMyCollection,
    getCollectionItemById,
    deleteFromCollection,
    importCollectionCSV,
    exportCollectionCSV,
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
import { csvUpload, uploadCover } from '../middlewares/upload.middleware';

const router = Router();

// CSV import endpoints (must be before /:itemId to avoid route conflicts)
router.get('/template', protectRoute, downloadTemplate);
router.post('/import', protectRoute, csvUpload.single('file'), importCollectionCSV);
router.get('/export', protectRoute, exportCollectionCSV);
router.get('/import/logs', protectRoute, getImportLogs);
router.get('/import/logs/:logId', protectRoute, getImportLogById);
router.get('/import/logs/:logId/download', protectRoute, downloadImportLog);

// Style filter endpoint (must be before /:itemId to avoid route conflicts)
router.get('/styles', protectRoute, getStyles);
router.get('/sync-info', protectRoute, getCollectionSyncInfo);

// Manual album entry (must be before /:itemId to avoid route conflicts)
router.post('/manual', protectRoute, uploadCover, addManualAlbum);

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
