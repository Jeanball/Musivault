import mongoose, { Schema, Document } from "mongoose";

export interface IMigration extends Document {
  migrationId: string;
  description: string;
  executedAt: Date;
  durationMs: number;
  status: 'success' | 'failed' | 'skipped';
  details?: string;
}

const migrationSchema = new Schema<IMigration>({
  migrationId: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  executedAt: {
    type: Date,
    default: Date.now,
  },
  durationMs: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'skipped'],
    default: 'success',
  },
  details: {
    type: String,
    default: '',
  },
});

const Migration = mongoose.model<IMigration>("Migration", migrationSchema);
export default Migration;
