import mongoose, { Schema, Document } from 'mongoose';

/** A release in the user's Discogs collection. */
export interface IDiscogsReportRelease {
    releaseId: number;
    instanceId: number;
    artist: string;
    title: string;
    year?: number;
    thumb?: string;
    format?: string;
    dateAdded: Date;
}

/** An item in the user's Musivault collection. */
export interface IDiscogsReportItem {
    itemId: mongoose.Types.ObjectId;
    artist: string;
    title: string;
    year?: string;
    format?: string;
    /** Discogs release id of the item's album, when it has one. */
    discogsId?: number;
}

/** An item whose release is not in the Discogs collection, paired with the Discogs entry that likely replaced it. */
export interface IDiscogsReportMerged {
    item: IDiscogsReportItem;
    release: IDiscogsReportRelease;
}

export interface IDiscogsSyncReport extends Document {
    user: mongoose.Types.ObjectId;
    status: 'queued' | 'running' | 'completed' | 'error';
    /** Set with `status: 'error'`: `needsReconnect` when Discogs rejected the token, `failed` otherwise. */
    errorCode?: 'needsReconnect' | 'failed';
    startedAt: Date;
    finishedAt?: Date;
    /** Discogs pages fetched so far and in total (the total is known after the first page). */
    progress: { page: number; pages: number };
    username: string;
    counts: {
        discogs: number;
        matched: number;
        newOnDiscogs: number;
        merged: number;
        onlyInMusivault: number;
        dateDiffers: number;
    };
    newOnDiscogs: IDiscogsReportRelease[];
    merged: IDiscogsReportMerged[];
    onlyInMusivault: IDiscogsReportItem[];
}

const releaseSchema = new Schema<IDiscogsReportRelease>({
    releaseId: { type: Number, required: true },
    instanceId: { type: Number, required: true },
    artist: { type: String, default: '' },
    title: { type: String, default: '' },
    year: { type: Number },
    thumb: { type: String },
    format: { type: String },
    dateAdded: { type: Date, required: true }
}, { _id: false });

const itemSchema = new Schema<IDiscogsReportItem>({
    itemId: { type: Schema.Types.ObjectId, required: true },
    artist: { type: String, default: '' },
    title: { type: String, default: '' },
    year: { type: String },
    format: { type: String },
    discogsId: { type: Number }
}, { _id: false });

const mergedSchema = new Schema<IDiscogsReportMerged>({
    item: { type: itemSchema, required: true },
    release: { type: releaseSchema, required: true }
}, { _id: false });

// One report per user: each check replaces the previous one.
const discogsSyncReportSchema = new Schema<IDiscogsSyncReport>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'error'], required: true },
    errorCode: { type: String, enum: ['needsReconnect', 'failed'] },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    progress: {
        page: { type: Number, default: 0 },
        pages: { type: Number, default: 0 }
    },
    username: { type: String, default: '' },
    counts: {
        discogs: { type: Number, default: 0 },
        matched: { type: Number, default: 0 },
        newOnDiscogs: { type: Number, default: 0 },
        merged: { type: Number, default: 0 },
        onlyInMusivault: { type: Number, default: 0 },
        dateDiffers: { type: Number, default: 0 }
    },
    newOnDiscogs: { type: [releaseSchema], default: [] },
    merged: { type: [mergedSchema], default: [] },
    onlyInMusivault: { type: [itemSchema], default: [] }
});

const DiscogsSyncReport = mongoose.model<IDiscogsSyncReport>('DiscogsSyncReport', discogsSyncReportSchema);

export default DiscogsSyncReport;
