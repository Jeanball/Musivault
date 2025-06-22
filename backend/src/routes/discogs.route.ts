import express from 'express';
import { searchDiscogs } from '../controllers/discogs.controller'

const router = express.Router();

router.get('/search', searchDiscogs);

export default router;