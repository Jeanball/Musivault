import express from 'express';
import { getMasterVersions, getReleaseAsVersions, getReleaseDetails, searchMasters, getArtistReleases } from '../controllers/discogs.controller'
import protectRoute from '../middlewares/protectRoute';

const router = express.Router();

router.get('/search', searchMasters);
router.get('/artist/:artistId/releases', getArtistReleases);
router.get('/release/:releaseId', getReleaseDetails);
router.get('/release/:releaseId/versions', getReleaseAsVersions);
router.get('/master/:masterId/versions', getMasterVersions);

export default router;