import express from 'express';
import { getMasterVersions, getReleaseDetails, searchMasters } from '../controllers/discogs.controller'
import protectRoute from '../middlewares/protectRoute';

const router = express.Router();

router.get('/search', searchMasters);
router.get('/release/:releaseId', getReleaseDetails);
router.get('/master/:masterId/versions', getMasterVersions);

export default router;