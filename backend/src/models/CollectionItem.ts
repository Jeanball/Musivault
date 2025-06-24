import mongoose, { Schema, Document } from "mongoose";

export interface ICollectionItem extends Document {
  user: mongoose.Types.ObjectId;
  album: mongoose.Types.ObjectId;
  format: string;
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
    type: String,
    required: true,
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
