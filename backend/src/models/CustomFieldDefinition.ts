import mongoose, { Schema, Document } from "mongoose";

export type CustomFieldType = "text" | "textarea";

export interface ICustomFieldDefinition extends Document<mongoose.Types.ObjectId> {
  user: mongoose.Types.ObjectId;
  name: string;
  type: CustomFieldType;
  placeholder?: string;
  order: number;
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
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

customFieldDefinitionSchema.index({ user: 1, order: 1 });

const CustomFieldDefinition = mongoose.model<ICustomFieldDefinition>(
  "CustomFieldDefinition",
  customFieldDefinitionSchema
);

export default CustomFieldDefinition;
