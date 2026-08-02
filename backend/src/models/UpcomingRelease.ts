import mongoose, { Schema, Document } from "mongoose";

export interface IUpcomingRelease extends Document {
  mbid: string;
  title: string;
  artist: string;
  style: string;
  firstReleaseDate: string;
  datePrecision: 'day' | 'month';
  primaryType: 'Album' | 'EP';
  secondaryTypes: string[];
  coverArtUrl?: string;
  fetchedAt: Date;
}

const upcomingReleaseSchema = new Schema<IUpcomingRelease>({
  mbid: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  artist: {
    type: String,
    required: true,
  },
  style: {
    type: String,
    required: true,
  },
  firstReleaseDate: {
    type: String,
    required: true,
  },
  datePrecision: {
    type: String,
    enum: ['day', 'month'],
    required: true,
  },
  primaryType: {
    type: String,
    enum: ['Album', 'EP'],
    required: true,
  },
  secondaryTypes: {
    type: [String],
    default: [],
  },
  coverArtUrl: {
    type: String,
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
  },
});

upcomingReleaseSchema.index({ mbid: 1, style: 1 }, { unique: true });
upcomingReleaseSchema.index({ firstReleaseDate: 1 });

const UpcomingRelease = mongoose.model<IUpcomingRelease>("UpcomingRelease", upcomingReleaseSchema);
export default UpcomingRelease;
