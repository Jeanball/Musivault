import express from 'express';
import {  deleteUser, getAllUsers, updateUser, getUserById } from '../controllers/users.controller';

const router = express.Router()

router.get("/", getAllUsers);

router.get("/:id", getUserById);

router.put("/:id", updateUser);

router.delete("/:id", deleteUser);

export default router;