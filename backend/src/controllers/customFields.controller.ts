import { Request, Response } from "express";
import CustomFieldDefinition, {
  CustomFieldType,
  ICustomFieldDefinition,
} from "../models/CustomFieldDefinition";
import CollectionItem from "../models/CollectionItem";
import { logger } from '../config/logger.config';

const MAX_FIELDS_PER_USER = 20;

function serializeCustomFields(
  customFields: Map<string, string> | Record<string, string> | undefined
): Record<string, string> {
  if (!customFields) return {};
  if (customFields instanceof Map) {
    return Object.fromEntries(customFields);
  }
  return customFields;
}

export async function getCustomFieldDefinitions(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const fields = await CustomFieldDefinition.find({ user: req.user._id }).sort(
      { order: 1, createdAt: 1 }
    );

    res.status(200).json(fields);
  } catch (error) {
    logger.error({ err: error }, "Error fetching custom field definitions");
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function createCustomFieldDefinition(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { name, type, placeholder } = req.body as {
      name?: string;
      type?: CustomFieldType;
      placeholder?: string;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Field name is required" });
      return;
    }

    const existingCount = await CustomFieldDefinition.countDocuments({
      user: req.user._id,
    });

    if (existingCount >= MAX_FIELDS_PER_USER) {
      res.status(400).json({
        message: `You can have at most ${MAX_FIELDS_PER_USER} custom fields`,
      });
      return;
    }

    const duplicate = await CustomFieldDefinition.findOne({
      user: req.user._id,
      name: name.trim(),
    });

    if (duplicate) {
      res.status(409).json({ message: "A field with this name already exists" });
      return;
    }

    const maxOrderField = await CustomFieldDefinition.findOne({ user: req.user._id })
      .sort({ order: -1 })
      .select("order");

    const field = new CustomFieldDefinition({
      user: req.user._id,
      name: name.trim(),
      type: type === "textarea" ? "textarea" : "text",
      placeholder: placeholder?.trim() || "",
      order: (maxOrderField?.order ?? -1) + 1,
    });

    await field.save();
    res.status(201).json(field);
  } catch (error) {
    logger.error({ err: error }, "Error creating custom field definition");
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateCustomFieldDefinition(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { fieldId } = req.params;
    const { name, type, placeholder } = req.body as {
      name?: string;
      type?: CustomFieldType;
      placeholder?: string;
    };

    const field = await CustomFieldDefinition.findOne({
      _id: fieldId,
      user: req.user._id,
    });

    if (!field) {
      res.status(404).json({ message: "Custom field not found" });
      return;
    }

    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ message: "Field name is required" });
        return;
      }

      const duplicate = await CustomFieldDefinition.findOne({
        user: req.user._id,
        name: name.trim(),
        _id: { $ne: fieldId },
      });

      if (duplicate) {
        res.status(409).json({ message: "A field with this name already exists" });
        return;
      }

      field.name = name.trim();
    }

    if (type !== undefined) {
      field.type = type === "textarea" ? "textarea" : "text";
    }

    if (placeholder !== undefined) {
      field.placeholder = placeholder.trim();
    }

    await field.save();
    res.status(200).json(field);
  } catch (error) {
    logger.error({ err: error }, "Error updating custom field definition");
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteCustomFieldDefinition(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { fieldId } = req.params;

    const field = await CustomFieldDefinition.findOneAndDelete({
      _id: fieldId,
      user: req.user._id,
    });

    if (!field) {
      res.status(404).json({ message: "Custom field not found" });
      return;
    }

    await CollectionItem.updateMany(
      { user: req.user._id },
      { $unset: { [`customFields.${fieldId}`]: "" } }
    );

    res.status(200).json({ message: "Custom field deleted" });
  } catch (error) {
    logger.error({ err: error }, "Error deleting custom field definition");
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function validateCustomFieldValues(
  userId: string,
  customFields: Record<string, string>
): Promise<{ valid: boolean; error?: string; sanitized?: Record<string, string> }> {
  const fieldIds = Object.keys(customFields);

  if (fieldIds.length === 0) {
    return { valid: true, sanitized: {} };
  }

  const definitions = await CustomFieldDefinition.find({
    user: userId,
    _id: { $in: fieldIds },
  });

  const definitionMap = new Map(
    definitions.map((def: ICustomFieldDefinition) => [def._id.toString(), def])
  );

  const sanitized: Record<string, string> = {};

  for (const fieldId of fieldIds) {
    const definition = definitionMap.get(fieldId);
    if (!definition) {
      return { valid: false, error: `Unknown custom field: ${fieldId}` };
    }

    const value = customFields[fieldId];
    if (typeof value !== "string") {
      return { valid: false, error: `Invalid value for field "${definition.name}"` };
    }

    sanitized[fieldId] = value.trim();
  }

  return { valid: true, sanitized };
}

export { serializeCustomFields };
