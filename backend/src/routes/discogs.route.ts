import express from 'express';
import { getMasterVersions, getReleaseDetails, searchAlbums, searchArtists, getArtistReleases, searchByBarcode } from '../controllers/discogs.controller'
import protectRoute from '../middlewares/protectRoute.middleware';

const router = express.Router();

router.get('/search', protectRoute, searchAlbums);
router.get('/search/artists', protectRoute, searchArtists);
router.get('/search/barcode', protectRoute, searchByBarcode);
router.get('/artist/:artistId/releases', protectRoute, getArtistReleases);
router.get('/release/:releaseId', protectRoute, getReleaseDetails);
router.get('/master/:masterId/versions', protectRoute, getMasterVersions);

export default router;