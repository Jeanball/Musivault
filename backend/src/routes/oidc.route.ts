import { Router } from 'express';
import { initiateOIDCLogin, handleOIDCCallback, getOIDCStatus } from '../controllers/oidc.controller';

const router = Router();

router.get('/status', getOIDCStatus);
router.get('/login', initiateOIDCLogin);
router.get('/callback', handleOIDCCallback);

export default router;
