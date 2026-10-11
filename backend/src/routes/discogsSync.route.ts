import express from 'express';
import protectRoute from '../middlewares/protectRoute.middleware';
import { getDiscogsReport, getDiscogsSummary, startDiscogsApply, startDiscogsCheck, stopDiscogsApply } from '../controllers/discogsSync.controller';

const router = express.Router();

router.post('/check', protectRoute, startDiscogsCheck);
router.post('/apply', protectRoute, startDiscogsApply);
router.post('/apply/stop', protectRoute, stopDiscogsApply);
router.get('/report', protectRoute, getDiscogsReport);
router.get('/summary', protectRoute, getDiscogsSummary);

export default router;
