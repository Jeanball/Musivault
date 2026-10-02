import { Router } from 'express';
import { getUpcomingReleases, getApproximateLocation, getRecordShops, getConcerts, getConcert, geocode } from '../controllers/discover.controller';
import protectRoute from '../middlewares/protectRoute.middleware';

const router = Router();

router.get('/upcoming-releases', protectRoute, getUpcomingReleases);
router.get('/location', protectRoute, getApproximateLocation);
router.get('/record-shops', protectRoute, getRecordShops);
router.get('/concerts', protectRoute, getConcerts);
router.get('/concerts/:tmId', protectRoute, getConcert);
router.get('/geocode', protectRoute, geocode);

export default router;
