import express from 'express';
import protectRoute from '../middlewares/protectRoute.middleware';
import { getDiscogsReport, getDiscogsSummary, startDiscogsApply, startDiscogsCheck } from '../controllers/discogsSync.controller';

const router = express.Router();

router.post('/check', protectRoute, startDiscogsCheck);
router.post('/apply', protectRoute, startDiscogsApply);
router.get('/report', protectRoute, getDiscogsReport);
router.get('/summary', protectRoute, getDiscogsSummary);

export default router;
