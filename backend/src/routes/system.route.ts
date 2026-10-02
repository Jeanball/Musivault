import { Router } from 'express';
import { getVersionInfo, getHealth } from '../controllers/system.controller';

const router = Router();

router.get('/version', getVersionInfo);
router.get('/health', getHealth);

export default router;
