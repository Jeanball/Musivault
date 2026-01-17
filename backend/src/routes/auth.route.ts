
import { Router } from 'express';
import { loginUser, logoutUser, signupUser, userVerification } from '../controllers/auth.controller';
import { initiateOIDCLogin, handleOIDCCallback, getOIDCStatus } from '../controllers/oidc.controller';
import protectRoute from '../middlewares/protectRoute.middleware';

const router = Router();

router.post('/verify', userVerification);
router.post('/login', loginUser);
router.post('/signup', signupUser);
router.post('/logout', logoutUser);

// OIDC routes
router.get('/oidc/status', getOIDCStatus);
router.get('/oidc/login', initiateOIDCLogin);
router.get('/oidc/callback', handleOIDCCallback);

export default router;
