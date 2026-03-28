import mongoose, { Schema, Document } from "mongoose";

export interface IPriceCache {
  /** Price per condition grade from Discogs price_suggestions */
  mint?: number;
  nearMint?: number;
  veryGoodPlus?: number;
  veryGood?: number;
  goodPlus?: number;
  good?: number;
  fair?: number;
  poor?: number;
  currency: string;
  updatedAt?: Date;
}

export interface ICollectionItem extends Document {
  user: mongoose.Types.ObjectId;
  album: mongoose.Types.ObjectId;
  format: {
    name: string;
    descriptions: string[];
    text: string;
  };
  mediaCondition?: string;
  sleeveCondition?: string;
  priceCache?: IPriceCache;
  addedAt: Date;
}

const priceCacheSchema = new Schema<IPriceCache>({
  mint: { type: Number, default: null },
  nearMint: { type: Number, default: null },
  veryGoodPlus: { type: Number, default: null },
  veryGood: { type: Number, default: null },
  goodPlus: { type: Number, default: null },
  good: { type: Number, default: null },
  fair: { type: Number, default: null },
  poor: { type: Number, default: null },
  currency: { type: String, default: 'USD' },
  updatedAt: { type: Date, default: null },
}, { _id: false });

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
  mediaCondition: {
    type: String,
    default: null,
  },
  sleeveCondition: {
    type: String,
    default: null,
  },
  priceCache: {
    type: priceCacheSchema,
    default: null,
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
