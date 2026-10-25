import { Router } from 'express';
import { initiateOIDCLogin, handleOIDCCallback } from '../controllers/oidc.controller';

const router = Router();

router.get('/login', initiateOIDCLogin);
router.get('/callback', handleOIDCCallback);

export default router;
