import express from 'express';
import { getSpotifyAlbum } from '../controllers/spotify.controller';
import protectRoute from '../middlewares/protectRoute.middleware';

const router = express.Router();

router.get('/album', protectRoute, getSpotifyAlbum);

export default router;
