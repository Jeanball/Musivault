import { Router } from 'express';
import { loginUser, logoutUser, signupUser, verifyUser } from '../controllers/auth.controller';
import { userVerification } from '../middlewares/AuthMiddleware';

const router = Router();

router.post('/', userVerification);
router.post('/login', loginUser);
router.post('/signup', signupUser);
router.post('/logout', logoutUser);
router.post('/verify', verifyUser)

export default router;
