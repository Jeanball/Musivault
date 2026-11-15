import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import CustomFieldDefinition, {
  CUSTOM_FIELD_DEFAULT_TABLE_WIDTH_REM,
  CUSTOM_FIELD_MAX_TABLE_WIDTH_REM,
  CUSTOM_FIELD_MIN_TABLE_WIDTH_REM,
  CustomFieldType,
  ICustomFieldDefinition,
} from "../models/CustomFieldDefinition";
import CollectionItem from "../models/CollectionItem";
import { logger } from '../config/logger.config';

const MAX_FIELDS_PER_USER = 20;

/**
 * Read the requested table column width. Returns `undefined` when the request
 * does not mention it and `null` when the value is out of range.
 */
function parseTableWidthRem(raw: unknown): number | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = Number(raw);
  if (
    !Number.isInteger(value) ||
    value < CUSTOM_FIELD_MIN_TABLE_WIDTH_REM ||
    value > CUSTOM_FIELD_MAX_TABLE_WIDTH_REM
  ) {
    return null;
  }
  return value;
}

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

    const { name, type, placeholder, tableWidthRem } = req.body as {
      name?: string;
      type?: CustomFieldType;
      placeholder?: string;
      tableWidthRem?: number | string;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Field name is required" });
      return;
    }

    const width = parseTableWidthRem(tableWidthRem);
    if (width === null) {
      res.status(400).json({
        message: `Table width must be between ${CUSTOM_FIELD_MIN_TABLE_WIDTH_REM} and ${CUSTOM_FIELD_MAX_TABLE_WIDTH_REM} rem`,
      });
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
      tableWidthRem: type === "textarea"
        ? CUSTOM_FIELD_DEFAULT_TABLE_WIDTH_REM
        : width ?? CUSTOM_FIELD_DEFAULT_TABLE_WIDTH_REM,
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
    const { name, type, placeholder, tableWidthRem } = req.body as {
      name?: string;
      type?: CustomFieldType;
      placeholder?: string;
      tableWidthRem?: number | string;
    };

    const width = parseTableWidthRem(tableWidthRem);
    if (width === null) {
      res.status(400).json({
        message: `Table width must be between ${CUSTOM_FIELD_MIN_TABLE_WIDTH_REM} and ${CUSTOM_FIELD_MAX_TABLE_WIDTH_REM} rem`,
      });
      return;
    }

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

    if (width !== undefined) {
      field.tableWidthRem = width;
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

  // A malformed id cannot belong to any definition and would make the query
  // below throw a cast error, so reject it before touching the database.
  const malformed = fieldIds.find((fieldId) => !isValidObjectId(fieldId));
  if (malformed) {
    return { valid: false, error: `Unknown custom field: ${malformed}` };
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
