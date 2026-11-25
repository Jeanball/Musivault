import type { IAlbum } from '../models/Album';
import type { IAlbumOverrides } from '../models/CollectionItem';

/** The album fields a user can change, in the order they are compared. */
export const ALBUM_OVERRIDE_FIELDS = [
    'title',
    'artist',
    'year',
    'genres',
    'styles',
    'tracklist',
    'labels'
] as const;

export type AlbumOverrideField = typeof ALBUM_OVERRIDE_FIELDS[number];

/** Any album shape works: a Mongoose document, a plain object or a lean result. */
type AlbumLike = Partial<IAlbum>;

/** True when the object actually carries an edit (an empty object does not). */
export function hasAlbumOverrides(
    overrides: IAlbumOverrides | null | undefined
): overrides is IAlbumOverrides {
    if (!overrides) return false;
    return ALBUM_OVERRIDE_FIELDS.some(field => overrides[field] !== undefined)
        || overrides.cover_image !== undefined
        || overrides.thumb !== undefined;
}

/**
 * A populated album as a plain object: a Mongoose document or an already plain
 * object both work, so callers do not need to know which one they hold.
 */
export function toPlainAlbum<T extends AlbumLike>(album: T): T {
    const source = album as unknown as { toObject?: () => T };
    return typeof source.toObject === 'function' ? source.toObject() : album;
}

/**
 * Overrides read from MongoDB are a nested Mongoose document. Spreading one
 * yields its internals instead of the stored fields, so turn it into a plain
 * object first.
 */
function toPlainOverrides(overrides: IAlbumOverrides | null | undefined): IAlbumOverrides {
    if (!overrides) return {};
    const source = overrides as unknown as { toObject?: () => IAlbumOverrides };
    return typeof source.toObject === 'function' ? source.toObject() : overrides;
}

/**
 * Build the album the user sees: the shared Discogs album with their own edits
 * laid over it. The input is never mutated.
 */
export function mergeAlbumOverrides<T extends AlbumLike>(
    album: T,
    overrides: IAlbumOverrides | null | undefined
): T {
    if (!hasAlbumOverrides(overrides)) return album;
    return { ...album, ...toPlainOverrides(overrides) };
}

function normalizeValue(field: AlbumOverrideField, value: unknown): unknown {
    if (field === 'labels') {
        // discogsId is internal: a label the user did not change must compare equal.
        // Discogs stores "none" for a label without a catalog number, while the
        // edit form shows that box empty. They must normalize the same way or
        // saving only custom fields marks the album as locally modified.
        return ((value as IAlbum['labels']) || []).map(label => {
            const catno = label?.catno || '';
            return {
                name: (label?.name || '').trim(),
                catno: catno.trim().toLowerCase() === 'none' ? '' : catno.trim()
            };
        });
    }
    if (field === 'tracklist') {
        return ((value as IAlbum['tracklist']) || []).map(track => ({
            position: track?.position || '',
            title: track?.title || '',
            duration: track?.duration || '',
            artist: track?.artist || ''
        }));
    }
    if (field === 'genres' || field === 'styles') return (value as string[]) || [];
    // The edit form trims text fields, so whitespace alone is not a local edit.
    if (typeof value === 'string') return value.trim();
    return value ?? '';
}

/** True when a value matches the shared album's, so no override is needed. */
export function albumValueEquals(field: AlbumOverrideField, a: unknown, b: unknown): boolean {
    return JSON.stringify(normalizeValue(field, a)) === JSON.stringify(normalizeValue(field, b));
}

/**
 * Recompute the override map after an edit. Only the fields present in `desired`
 * are touched; anything equal to the shared album is dropped from the map.
 */
export function buildAlbumOverrides(
    base: AlbumLike,
    existing: IAlbumOverrides | null | undefined,
    desired: IAlbumOverrides
): IAlbumOverrides | null {
    const next: IAlbumOverrides = { ...toPlainOverrides(existing) };

    for (const field of ALBUM_OVERRIDE_FIELDS) {
        if (!(field in desired)) continue;
        if (albumValueEquals(field, desired[field], base[field])) {
            delete next[field];
        } else {
            (next as Record<string, unknown>)[field] = desired[field];
        }
    }

    // The cover and its thumbnail are one unit: storing only one would leave the
    // grid and the detail page showing different images.
    if ('cover_image' in desired || 'thumb' in desired) {
        const cover = desired.cover_image ?? desired.thumb ?? '';
        if (cover === (base.cover_image || '')) {
            delete next.cover_image;
            delete next.thumb;
        } else {
            next.cover_image = cover;
            next.thumb = cover;
        }
    }

    return hasAlbumOverrides(next) ? next : null;
}

/**
 * A populated collection item with the user's album edits applied. Applied to
 * the serialized copy, never to the shared Album document itself.
 */
export function applyAlbumOverrides<T extends { album?: unknown; albumOverrides?: IAlbumOverrides | null }>(
    entry: T
): T {
    const overrides = entry?.albumOverrides;
    if (!hasAlbumOverrides(overrides) || !entry.album) return entry;

    const source = entry as unknown as { toObject?: () => Record<string, unknown> };
    const plain: Record<string, unknown> = typeof source.toObject === 'function'
        ? source.toObject()
        // A plain object is copied too, so the caller's item keeps its album.
        : { ...(entry as unknown as Record<string, unknown>) };

    // toObject() keeps Mongoose Maps as Map instances, which JSON.stringify turns
    // into {}. Collections with local edits go through this helper before the
    // response is sent, so custom field values must be plain objects here.
    if (plain.customFields instanceof Map) {
        plain.customFields = Object.fromEntries(plain.customFields);
    }

    const album = plain.album;
    const albumPlain = typeof (album as { toObject?: () => unknown } | null)?.toObject === 'function'
        ? (album as { toObject: () => Record<string, unknown> }).toObject()
        : album;

    plain.album = { ...(albumPlain as object), ...toPlainOverrides(overrides) };
    return plain as unknown as T;
}

/** Apply the edits to every item in a list, e.g. a collection response. */
export function applyAlbumOverridesToAll<T extends { album?: unknown; albumOverrides?: IAlbumOverrides | null }>(
    entries: T[]
): T[] {
    return entries.map(applyAlbumOverrides);
}
