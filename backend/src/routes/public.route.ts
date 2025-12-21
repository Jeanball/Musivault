import { Router } from 'express';
import { getPublicCollection, getPublicUsers } from '../controllers/public.controller';

const router = Router();

// List all public users - must be before /:shareId
router.get('/users', getPublicUsers);

// Public collection endpoint - no authentication required
router.get('/:shareId', getPublicCollection);

export default router;
