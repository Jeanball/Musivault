import express from 'express';
import protectRoute from '../middlewares/protectRoute.middleware';
import { getExchangeRates, getPreferences, updatePreferences } from '../controllers/preferences.controller';

const router = express.Router();

router.get('/', protectRoute, getPreferences);
router.put('/', protectRoute, updatePreferences);
router.get('/exchange-rates', protectRoute, getExchangeRates);

export default router;
