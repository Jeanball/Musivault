import express from 'express';
import { createUser, deleteUser, getAllUsers, updateUser, getUserById } from '../controllers/users.controller';

const router = express.Router()

router.get("/", getAllUsers);

router.get("/:id", getUserById);

router.post("/", createUser);

router.put("/:id", updateUser);

router.delete("/:id", deleteUser);

export default router;