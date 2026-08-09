
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginUser, logoutUser, signupUser, userVerification } from '../controllers/auth.controller';
import oidcRoute from './oidc.route';

const router = Router();

/**
 * Only the credential endpoints are throttled. /verify is called on every
 * layout mount, so counting it here used to exhaust the window during normal
 * navigation and then reject the login that followed.
 */
const credentialsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts. Try again in a few minutes.' }
});

router.post('/verify', userVerification);
router.post('/login', credentialsLimiter, loginUser);
router.post('/signup', credentialsLimiter, signupUser);
router.post('/logout', logoutUser);

router.use('/oidc', oidcRoute);

export default router;
