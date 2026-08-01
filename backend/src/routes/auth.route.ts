
import { Router } from 'express';
import { loginUser, logoutUser, signupUser, userVerification } from '../controllers/auth.controller';
import oidcRoute from './oidc.route';

const router = Router();

router.post('/verify', userVerification);
router.post('/login', loginUser);
router.post('/signup', signupUser);
router.post('/logout', logoutUser);

router.use('/oidc', oidcRoute);

export default router;
