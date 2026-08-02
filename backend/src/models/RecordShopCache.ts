import mongoose, { Schema, Document } from "mongoose";

/** A record shop as normalised from an OpenStreetMap element. */
export interface ICachedShop {
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  name: string;
  lat: number;
  lon: number;
  street?: string;
  city?: string;
  postcode?: string;
  country?: string;
  website?: string;
  phone?: string;
  openingHours?: string;
}

/**
 * One Overpass response per geographic tile (see roundToTile). Shops move
 * rarely, so entries are refreshed on read once past the TTL rather than by a
 * scheduled task.
 */
export interface IRecordShopCache extends Document {
  /** Tile centre and radius band, e.g. "48.9,2.4@110". */
  tileKey: string;
  shops: ICachedShop[];
  fetchedAt: Date;
}

const cachedShopSchema = new Schema<ICachedShop>({
  osmType: {
    type: String,
    enum: ['node', 'way', 'relation'],
    required: true,
  },
  osmId: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  lat: {
    type: Number,
    required: true,
  },
  lon: {
    type: Number,
    required: true,
  },
  street: { type: String },
  city: { type: String },
  postcode: { type: String },
  country: { type: String },
  website: { type: String },
  phone: { type: String },
  openingHours: { type: String },
}, { _id: false });

const recordShopCacheSchema = new Schema<IRecordShopCache>({
  tileKey: {
    type: String,
    required: true,
    unique: true,
  },
  shops: {
    type: [cachedShopSchema],
    default: [],
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
  },
});

const RecordShopCache = mongoose.model<IRecordShopCache>("RecordShopCache", recordShopCacheSchema);
export default RecordShopCache;
