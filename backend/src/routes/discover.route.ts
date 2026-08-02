import { Router } from 'express';
import { getUpcomingReleases } from '../controllers/discover.controller';
import protectRoute from '../middlewares/protectRoute.middleware';

const router = Router();

router.get('/upcoming-releases', protectRoute, getUpcomingReleases);

export default router;
