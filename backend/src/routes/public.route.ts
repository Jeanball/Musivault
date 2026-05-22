import { Router } from 'express';
import { getPublicCollection, getPublicUsers, getLatestPublicAlbums } from '../controllers/public.controller';

const router = Router();

// List latest albums from public users
router.get('/albums/latest', getLatestPublicAlbums);

// List all public users - must be before /:shareId
router.get('/users', getPublicUsers);

// Public collection endpoint - no authentication required
router.get('/:shareId', getPublicCollection);

export default router;
