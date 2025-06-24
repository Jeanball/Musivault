import express from 'express';
import { getReleaseDetails, searchDiscogs } from '../controllers/discogs.controller'

const router = express.Router();

router.get('/search', searchDiscogs);
router.get('/release/:releaseId', getReleaseDetails);

export default router;