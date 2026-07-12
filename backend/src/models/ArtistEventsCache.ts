import mongoose, { Schema, Document } from 'mongoose';

// ===== Types =====

export interface ICachedEvent {
  bandsintown_id: string;
  artist_name: string;
  title: string;
  datetime: string;
  url: string;
  venue: {
    name: string;
    city: string;
    region: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
  };
  lineup: string[];
}

export interface IArtistEventsCache extends Document {
  artistName: string;
  events: ICachedEvent[];
  updatedAt: Date;
}

// ===== Schema =====

const cachedEventSchema = new Schema<ICachedEvent>({
  bandsintown_id: { type: String, default: '' },
  artist_name: { type: String, default: '' },
  title: { type: String, default: '' },
  datetime: { type: String, default: '' },
  url: { type: String, default: '' },
  venue: {
    name: { type: String, default: '' },
    city: { type: String, default: '' },
    region: { type: String, default: '' },
    country: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  lineup: { type: [String], default: [] },
}, { _id: false });

const artistEventsCacheSchema = new Schema<IArtistEventsCache>({
  artistName: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  },
  events: {
    type: [cachedEventSchema],
    default: [],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const ArtistEventsCache = mongoose.model<IArtistEventsCache>('ArtistEventsCache', artistEventsCacheSchema);

export default ArtistEventsCache;
