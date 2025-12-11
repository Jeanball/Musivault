import { Router } from 'express';
import { getPublicCollection } from '../controllers/public.controller';

const router = Router();

// Public collection endpoint - no authentication required
router.get('/:shareId', getPublicCollection);

export default router;
