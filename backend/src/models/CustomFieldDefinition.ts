import mongoose, { Schema, Document } from "mongoose";
import { randomUUID } from "crypto";

export type CustomFieldType = "text" | "textarea";

export interface ICustomFieldDefinition extends Document<mongoose.Types.ObjectId> {
  user: mongoose.Types.ObjectId;
  name: string;
  type: CustomFieldType;
  placeholder?: string;
  order: number;
  /**
   * Stable identifier embedded in CSV exports. The name can be changed at any
   * time; this is what an import uses to find the same field again.
   */
  uuid: string;
  createdAt: Date;
  updatedAt: Date;
}

const customFieldDefinitionSchema = new Schema<ICustomFieldDefinition>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: ["text", "textarea"],
      default: "text",
    },
    placeholder: {
      type: String,
      default: "",
      maxlength: 500,
    },
    uuid: {
      type: String,
      // Fields created before the uuid existed are backfilled on startup by
      // `backfill-custom-field-uuids`, and lazily before an export/import.
      default: () => randomUUID(),
      select: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      // Hidden implementation detail: the client keeps using `_id`.
      transform: (_doc, ret) => {
        delete (ret as { uuid?: string }).uuid;
        return ret;
      },
    },
  }
);

customFieldDefinitionSchema.index({ user: 1, order: 1 });
// Two fields of the same user must not claim the same export identity.
customFieldDefinitionSchema.index({ user: 1, uuid: 1 }, { unique: true, sparse: true });

const CustomFieldDefinition = mongoose.model<ICustomFieldDefinition>(
  "CustomFieldDefinition",
  customFieldDefinitionSchema
);

export default CustomFieldDefinition;
