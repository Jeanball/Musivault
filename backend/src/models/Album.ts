import mongoose, { Schema, Document } from "mongoose";

export interface ITrack {
  position: string;
  title: string;
  duration: string;
  artist?: string;
}

export interface ILabel {
  name: string;
  catno: string;
}

export interface IAlbum extends Document {
  discogsId?: number;
  isManual: boolean;
  title: string;
  artist: string;
  year: string;
  thumb: string;
  cover_image: string;
  styles: string[];
  tracklist: ITrack[];
  labels: ILabel[];
}

const trackSchema = new Schema<ITrack>({
  position: { type: String, default: '' },
  title: { type: String, default: '' },
  duration: { type: String, default: '' },
  artist: { type: String, default: '' },
}, { _id: false });

const labelSchema = new Schema<ILabel>({
  name: { type: String, default: '' },
  catno: { type: String, default: '' },
}, { _id: false });

const albumSchema = new Schema<IAlbum>({
  discogsId: {
    type: Number,
    unique: true,
    sparse: true, // Allows null/undefined values while maintaining uniqueness for non-null
    index: true,
  },
  isManual: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
  },
  artist: {
    type: String,
    required: true,
  },
  year: {
    type: String,
  },
  thumb: {
    type: String,
  },
  cover_image: {
    type: String,
  },
  styles: {
    type: [String],
    default: [],
  },
  tracklist: {
    type: [trackSchema],
    default: [],
  },
  labels: {
    type: [labelSchema],
    default: [],
  },
});

const Album = mongoose.model<IAlbum>("Album", albumSchema);
export default Album;
