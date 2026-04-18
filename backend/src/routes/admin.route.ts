import express from 'express';
import { getAdminTasks, runAdminTask, subscribeAdminTask, getTaskLogs } from '../controllers/admin.controller';
import protectRoute from '../middlewares/protectRoute.middleware';
import requireAdmin from '../middlewares/requireAdmin.middleware';

const router = express.Router();

router.use(protectRoute);
router.use(requireAdmin);

router.get('/tasks', getAdminTasks);
router.get('/tasks/logs', getTaskLogs);
router.post('/tasks/:taskId/run', runAdminTask);
router.get('/tasks/:taskId/subscribe', subscribeAdminTask);

export default router;
