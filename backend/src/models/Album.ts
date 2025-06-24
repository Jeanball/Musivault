import mongoose, { Schema, Document } from "mongoose";

export interface IAlbum extends Document {
  discogsId: number;
  title: string;
  artist: string;
  year: string;
  thumb: string;
  cover_image: string;
}

const albumSchema = new Schema<IAlbum>({
  discogsId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
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
});

const Album = mongoose.model<IAlbum>("Album", albumSchema);
export default Album;
