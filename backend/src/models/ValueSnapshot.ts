import mongoose, { Document, Schema } from 'mongoose';

export interface IValueSnapshot extends Document {
  user: mongoose.Types.ObjectId;
  /** Calendar day of the snapshot, 'YYYY-MM-DD'. */
  day: string;
  capturedAt: Date;
  /** USD, like priceCache: the conversion to the user's currency happens on render. */
  totalValue: number;
  /** How many items carried a price, so a total can be read against its coverage. */
  itemCount: number;
}

const valueSnapshotSchema = new Schema<IValueSnapshot>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  day: {
    type: String,
    required: true,
  },
  capturedAt: {
    type: Date,
    default: Date.now,
  },
  totalValue: {
    type: Number,
    default: 0,
  },
  itemCount: {
    type: Number,
    default: 0,
  },
});

// One point per user per day, enforced rather than hoped for: the chart refreshes
// the current day on every read, and without this it would stack a point per visit.
// The same index serves the only read there is, a user's series ordered by day.
valueSnapshotSchema.index({ user: 1, day: 1 }, { unique: true });

const ValueSnapshot = mongoose.model<IValueSnapshot>('ValueSnapshot', valueSnapshotSchema);

export default ValueSnapshot;
