import mongoose, { Schema, Document } from "mongoose";

/** A concert as normalised from a Ticketmaster Discovery event. */
export interface ICachedEvent {
  tmId: string;
  name: string;
  url: string;
  imageUrl?: string;
  /** "YYYY-MM-DD" in the venue's own timezone. */
  startLocalDate: string;
  startLocalTime?: string;
  dateTBA: boolean;
  timeTBA: boolean;
  /** onsale | offsale | cancelled | postponed | rescheduled */
  status?: string;
  genre?: string;
  subGenre?: string;
  priceMin?: number;
  priceMax?: number;
  priceCurrency?: string;
  venueName: string;
  venueCity?: string;
  lat: number;
  lon: number;
  /** Performer names, used to match against the user's own artists. */
  attractions: string[];
}

/**
 * One Ticketmaster sweep per geographic tile (see roundToTile), refreshed on
 * read once past the TTL. Unlike shops, concert listings churn constantly —
 * new onsales, cancellations, added dates — so the TTL is hours, not weeks.
 */
export interface IConcertCache extends Document {
  /** Tile centre and radius band, e.g. "45.5,-73.6@110". */
  tileKey: string;
  events: ICachedEvent[];
  fetchedAt: Date;
}

const cachedEventSchema = new Schema<ICachedEvent>({
  tmId: { type: String, required: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  imageUrl: { type: String },
  startLocalDate: { type: String, required: true },
  startLocalTime: { type: String },
  dateTBA: { type: Boolean, default: false },
  timeTBA: { type: Boolean, default: false },
  status: { type: String },
  genre: { type: String },
  subGenre: { type: String },
  priceMin: { type: Number },
  priceMax: { type: Number },
  priceCurrency: { type: String },
  venueName: { type: String, required: true },
  venueCity: { type: String },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  attractions: { type: [String], default: [] },
}, { _id: false });

const concertCacheSchema = new Schema<IConcertCache>({
  tileKey: {
    type: String,
    required: true,
    unique: true,
  },
  events: {
    type: [cachedEventSchema],
    default: [],
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
  },
});

const ConcertCache = mongoose.model<IConcertCache>("ConcertCache", concertCacheSchema);
export default ConcertCache;
