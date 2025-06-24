import { Router } from 'express';
import { addToCollection, getMyCollection } from '../controllers/collection.controller';
import protectRoute from '../middlewares/protectRoute';

const router = Router();


router.post('/', protectRoute, addToCollection);
router.get('/', protectRoute, getMyCollection);
// router.delete('/:itemId', protectRoute, removeFromCollection);


export default router;