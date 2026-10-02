import express from 'express';
import { getMasterVersions, getReleaseDetails, getReleasePrice, searchAlbums, searchArtists, getArtistReleases, searchByBarcode, lookupByReference, getLabelInfo } from '../controllers/discogs.controller'
import protectRoute from '../middlewares/protectRoute.middleware';

const router = express.Router();

router.get('/search', protectRoute, searchAlbums);
router.get('/search/artists', protectRoute, searchArtists);
router.get('/search/barcode', protectRoute, searchByBarcode);
router.get('/lookup', protectRoute, lookupByReference);
router.get('/artist/:artistId/releases', protectRoute, getArtistReleases);
router.get('/label', protectRoute, getLabelInfo);
router.get('/release/:releaseId', protectRoute, getReleaseDetails);
router.get('/release/:releaseId/price', protectRoute, getReleasePrice);
router.get('/master/:masterId/versions', protectRoute, getMasterVersions);

export default router;