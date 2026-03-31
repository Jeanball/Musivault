import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminTaskExecution extends Document {
  taskId: string;
  executedAt: Date;
  durationMs: number;
  status: 'success' | 'failed';
  details?: string;
}

const adminTaskExecutionSchema = new Schema<IAdminTaskExecution>({
  taskId: {
    type: String,
    required: true,
    index: true,
  },
  executedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  durationMs: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true,
  },
  details: {
    type: String,
    default: '',
  },
});

const AdminTaskExecution = mongoose.model<IAdminTaskExecution>('AdminTaskExecution', adminTaskExecutionSchema);

export default AdminTaskExecution;
