import express from 'express';
import { getMasterVersions, getReleaseDetails, searchAlbums, searchArtists, getArtistReleases } from '../controllers/discogs.controller'
import protectRoute from '../middlewares/protectRoute';

const router = express.Router();

router.get('/search', searchAlbums);
router.get('/search/artists', searchArtists);
router.get('/artist/:artistId/releases', getArtistReleases);
router.get('/release/:releaseId', getReleaseDetails);
router.get('/master/:masterId/versions', getMasterVersions);

export default router;