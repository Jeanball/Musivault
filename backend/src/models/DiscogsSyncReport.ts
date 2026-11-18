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
    /** Condition grades from the user's Discogs fields, in Musivault's codes (`VG+`, `NM`, ...). */
    mediaCondition?: string;
    sleeveCondition?: string;
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

/**
 * An item whose release is not in the Discogs collection, paired with the Discogs entry that replaced it.
 * `match` is `instance` when the item's stored Discogs instance id was found under the new release (exact),
 * `guess` when it was paired by artist, title, format and year (likely).
 */
export interface IDiscogsReportMerged {
    item: IDiscogsReportItem;
    release: IDiscogsReportRelease;
    match: 'instance' | 'guess';
}

/** A record the last apply could not add or relink. */
export interface IDiscogsApplyFailure {
    kind: 'add' | 'relink';
    artist: string;
    title: string;
    releaseId: number;
    reason: string;
}

/** The latest apply: what the user ticked, its progress, and what came of it. */
export interface IDiscogsApply {
    status: 'queued' | 'running' | 'completed' | 'error';
    errorCode?: 'needsReconnect' | 'failed';
    /** `collection` while reading Discogs, then `records` (adds and relinks), then `dates`. */
    phase: 'collection' | 'records' | 'dates';
    startedAt: Date;
    finishedAt?: Date;
    /** Records to add or relink, and how many are done (skipped and failed ones count as done). */
    total: number;
    done: number;
    added: number;
    relinked: number;
    /** Ticked rows that no longer applied when the job ran (already added, merged differently, ...). */
    skipped: number;
    failed: number;
    useDiscogsDates: boolean;
    /** The user asked to stop; the job finishes the record it is on. */
    stopRequested?: boolean;
    /** The job ended early because it was stopped; `done` of `total` records were handled. */
    stopped?: boolean;
    datesUpdated: number;
    /** Items linked to their Discogs instance for the first time. */
    instanceIdsStored: number;
    failures: IDiscogsApplyFailure[];
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
    /** Absent until the user applies something. */
    apply?: IDiscogsApply;
}

const releaseSchema = new Schema<IDiscogsReportRelease>({
    releaseId: { type: Number, required: true },
    instanceId: { type: Number, required: true },
    artist: { type: String, default: '' },
    title: { type: String, default: '' },
    year: { type: Number },
    thumb: { type: String },
    format: { type: String },
    dateAdded: { type: Date, required: true },
    mediaCondition: { type: String },
    sleeveCondition: { type: String }
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
    release: { type: releaseSchema, required: true },
    match: { type: String, enum: ['instance', 'guess'], default: 'guess' }
}, { _id: false });

const applyFailureSchema = new Schema<IDiscogsApplyFailure>({
    kind: { type: String, enum: ['add', 'relink'], required: true },
    artist: { type: String, default: '' },
    title: { type: String, default: '' },
    releaseId: { type: Number, required: true },
    reason: { type: String, default: '' }
}, { _id: false });

const applySchema = new Schema<IDiscogsApply>({
    status: { type: String, enum: ['queued', 'running', 'completed', 'error'], required: true },
    errorCode: { type: String, enum: ['needsReconnect', 'failed'] },
    phase: { type: String, enum: ['collection', 'records', 'dates'], default: 'collection' },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    total: { type: Number, default: 0 },
    done: { type: Number, default: 0 },
    added: { type: Number, default: 0 },
    relinked: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    useDiscogsDates: { type: Boolean, default: false },
    stopRequested: { type: Boolean, default: false },
    stopped: { type: Boolean, default: false },
    datesUpdated: { type: Number, default: 0 },
    instanceIdsStored: { type: Number, default: 0 },
    failures: { type: [applyFailureSchema], default: [] }
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
    onlyInMusivault: { type: [itemSchema], default: [] },
    apply: { type: applySchema }
});

const DiscogsSyncReport = mongoose.model<IDiscogsSyncReport>('DiscogsSyncReport', discogsSyncReportSchema);

export default DiscogsSyncReport;
