import express from 'express';
import {  deleteUser, getAllUsers, updateUser, getUserById, createAdminUser } from '../controllers/users.controller';
import protectRoute from '../middlewares/protectRoute';
import requireAdmin from '../middlewares/requireAdmin';

const router = express.Router()

// Admin-only routes - require authentication and admin privileges
router.get("/", protectRoute, requireAdmin, getAllUsers);

router.get("/:id", protectRoute, requireAdmin, getUserById);

router.put("/:id", protectRoute, requireAdmin, updateUser);

router.delete("/:id", protectRoute, requireAdmin, deleteUser);

router.post('/admin/create', protectRoute, requireAdmin, createAdminUser);

export default router;