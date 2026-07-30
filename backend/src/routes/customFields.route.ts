import { Router } from "express";
import protectRoute from "../middlewares/protectRoute.middleware";
import {
  getCustomFieldDefinitions,
  createCustomFieldDefinition,
  updateCustomFieldDefinition,
  deleteCustomFieldDefinition,
} from "../controllers/customFields.controller";

const router = Router();

router.get("/", protectRoute, getCustomFieldDefinitions);
router.post("/", protectRoute, createCustomFieldDefinition);
router.put("/:fieldId", protectRoute, updateCustomFieldDefinition);
router.delete("/:fieldId", protectRoute, deleteCustomFieldDefinition);

export default router;
