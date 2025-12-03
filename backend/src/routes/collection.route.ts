import { Router } from 'express';
import multer from 'multer';
import { addToCollection, getMyCollection , deleteFromCollection, importCollectionCSV, downloadTemplate } from '../controllers/collection.controller';
import protectRoute from '../middlewares/protectRoute';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });


router.post('/', protectRoute, addToCollection);
router.get('/', protectRoute, getMyCollection);
router.delete('/:itemId', protectRoute, deleteFromCollection);

// CSV import endpoints
router.get('/template', protectRoute, downloadTemplate);
router.post('/import', protectRoute, upload.single('file'), importCollectionCSV);


export default router;