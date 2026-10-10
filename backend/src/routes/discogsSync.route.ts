import express from 'express';
import protectRoute from '../middlewares/protectRoute.middleware';
import { getDiscogsReport, startDiscogsCheck } from '../controllers/discogsSync.controller';

const router = express.Router();

router.post('/check', protectRoute, startDiscogsCheck);
router.get('/report', protectRoute, getDiscogsReport);

export default router;
