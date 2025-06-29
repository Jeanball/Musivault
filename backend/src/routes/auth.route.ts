import { Router } from 'express';
import { loginUser, logoutUser, signupUser } from '../controllers/auth.controller';
import { userVerification } from '../middlewares/AuthMiddleware';
import protectRoute from '../middlewares/protectRoute';

const router = Router();

router.post('/verify', protectRoute, userVerification);
router.post('/login', loginUser);
router.post('/signup', signupUser);
router.post('/logout', protectRoute, logoutUser);

export default router;
