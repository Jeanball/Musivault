import { Router } from 'express';
import { loginUser, logoutUser, signupUser } from '../controllers/auth.controller';
import { userVerification } from '../middlewares/AuthMiddleware';

const router = Router();

router.post('/verify', userVerification);
router.post('/login', loginUser);
router.post('/signup', signupUser);
router.post('/logout', logoutUser);

export default router;
