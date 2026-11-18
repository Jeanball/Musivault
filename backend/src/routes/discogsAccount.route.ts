import express from 'express';
import protectRoute from '../middlewares/protectRoute.middleware';
import {
    connectDiscogsAccount,
    disconnectDiscogsAccount,
    getDiscogsAccount
} from '../controllers/discogsAccount.controller';

const router = express.Router();

router.get('/', protectRoute, getDiscogsAccount);
router.put('/', protectRoute, connectDiscogsAccount);
router.delete('/', protectRoute, disconnectDiscogsAccount);

export default router;
