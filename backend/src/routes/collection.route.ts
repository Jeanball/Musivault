import { Router } from 'express';
import { addToCollection, getMyCollection , deleteFromCollection} from '../controllers/collection.controller';
import protectRoute from '../middlewares/protectRoute';

const router = Router();


router.post('/', protectRoute, addToCollection);
router.get('/', protectRoute, getMyCollection);
router.delete('/:itemId', protectRoute, deleteFromCollection);


export default router;