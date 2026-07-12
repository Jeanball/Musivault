import express from 'express';
import { nearbyShows } from '../controllers/shows.controller';
import protectRoute from '../middlewares/protectRoute.middleware';

const router = express.Router();

router.get('/nearby', protectRoute, nearbyShows);

export default router;
