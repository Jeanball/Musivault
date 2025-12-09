import mongoose, { Schema, Document } from 'mongoose';

export interface IImportLogEntry {
    rowIndex: number;
    inputArtist: string;
    inputAlbum: string;
    inputYear?: string;
    inputFormat: string;
    matchedArtist?: string;
    matchedAlbum?: string;
    matchedYear?: string;
    discogsId?: number;
    status: 'success' | 'failed' | 'skipped';
    reason?: string;
}

export interface IImportLog extends Document {
    user: mongoose.Types.ObjectId;
    importedAt: Date;
    fileName?: string;
    totalRows: number;
    successCount: number;
    failCount: number;
    skipCount: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
    entries: IImportLogEntry[];
}

const importLogEntrySchema = new Schema<IImportLogEntry>({
    rowIndex: { type: Number, required: true },
    inputArtist: { type: String, required: true },
    inputAlbum: { type: String, required: true },
    inputYear: { type: String },
    inputFormat: { type: String, required: true },
    matchedArtist: { type: String },
    matchedAlbum: { type: String },
    matchedYear: { type: String },
    discogsId: { type: Number },
    status: { type: String, enum: ['success', 'failed', 'skipped'], required: true },
    reason: { type: String }
}, { _id: false });

const importLogSchema = new Schema<IImportLog>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    importedAt: { type: Date, default: Date.now },
    fileName: { type: String },
    totalRows: { type: Number, required: true },
    successCount: { type: Number, required: true },
    failCount: { type: Number, required: true },
    skipCount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'error'], default: 'processing' },
    entries: [importLogEntrySchema]
});

// Index for efficient querying by user
importLogSchema.index({ user: 1, importedAt: -1 });

const ImportLog = mongoose.model<IImportLog>('ImportLog', importLogSchema);

export default ImportLog;
