import mongoose, { Schema, Document } from "mongoose";

export interface ICollectionItem extends Document {
  user: mongoose.Types.ObjectId;
  album: mongoose.Types.ObjectId;
  format: {
    name: string;
    descriptions: string[];
    text: string;
  };
  addedAt: Date;
}

const collectionItemSchema = new Schema<ICollectionItem>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  album: {
    type: Schema.Types.ObjectId,
    ref: "Album",
    required: true,
  },
  format: {
    name: { type: String, required: true },
    descriptions: { type: [String], default: [] },
    text: { type: String, default: '' },
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const CollectionItem = mongoose.model<ICollectionItem>(
  "CollectionItem",
  collectionItemSchema
);
export default CollectionItem;
