import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addManualAlbum, updateManualAlbum } from './collection.controller';
import { validateCustomFieldValues } from './customFields.controller';
import Album from '../models/Album';
import CollectionItem from '../models/CollectionItem';

vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../models/Album', () => ({
    default: vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
        Object.assign(this, data, { save: vi.fn().mockResolvedValue(undefined) });
    }),
}));

vi.mock('../models/CollectionItem', () => {
    const findById = vi.fn();
    const findOne = vi.fn();
    const model = vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
        Object.assign(this, data, { save: vi.fn().mockResolvedValue(undefined) });
    });
    Object.assign(model, { findById, findOne });
    return { default: model };
});

vi.mock('./customFields.controller', () => ({
    validateCustomFieldValues: vi.fn(),
}));

const response = () => {
    const res = {
        status: vi.fn(),
        json: vi.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
};

const request = (body: Record<string, unknown>, user = { _id: 'user-1' }) =>
    ({ user, body } as never);

describe('manual album custom fields', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('saves the custom fields sent by the form', async () => {
        vi.mocked(validateCustomFieldValues).mockResolvedValue({
            valid: true,
            sanitized: { 'field-1': 'Shelf A' },
        });

        const res = response();
        await addManualAlbum(
            request({
                title: 'Kind of Blue',
                artist: 'Miles Davis',
                format: 'Vinyl',
                // The form also sends blank fields; those must not reach the DB.
                customFields: JSON.stringify({ 'field-1': 'Shelf A', 'field-2': '   ' }),
            }),
            res as never
        );

        expect(validateCustomFieldValues).toHaveBeenCalledWith('user-1', { 'field-1': 'Shelf A' });
        expect(vi.mocked(CollectionItem)).toHaveBeenCalledWith(
            expect.objectContaining({ customFields: { 'field-1': 'Shelf A' } })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('stores broad genres and styles as separate lists', async () => {
        vi.mocked(validateCustomFieldValues).mockResolvedValue({ valid: true, sanitized: {} });

        const res = response();
        await addManualAlbum(
            request({
                title: 'Kind of Blue',
                artist: 'Miles Davis',
                format: 'Vinyl',
                genres: 'Jazz, Blues',
                styles: 'Modal; Cool Jazz',
            }),
            res as never
        );

        expect(vi.mocked(Album)).toHaveBeenCalledWith(
            expect.objectContaining({
                genres: ['Jazz', 'Blues'],
                styles: ['Modal', 'Cool Jazz'],
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('stores a cover localized by the Spotify importer', async () => {
        vi.mocked(validateCustomFieldValues).mockResolvedValue({ valid: true, sanitized: {} });

        const res = response();
        await addManualAlbum(
            request({
                title: 'Blue Train',
                artist: 'John Coltrane',
                format: 'Vinyl',
                coverImage: '/uploads/covers/spotify.jpg',
            }),
            res as never
        );

        expect(vi.mocked(Album)).toHaveBeenCalledWith(
            expect.objectContaining({
                cover_image: '/uploads/covers/spotify.jpg',
                thumb: '/uploads/covers/spotify.jpg',
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('rejects malformed custom field JSON', async () => {
        const res = response();
        await addManualAlbum(
            request({
                title: 'Kind of Blue',
                artist: 'Miles Davis',
                format: 'Vinyl',
                customFields: 'not json',
            }),
            res as never
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(vi.mocked(Album)).not.toHaveBeenCalled();
        expect(validateCustomFieldValues).not.toHaveBeenCalled();
    });

    it('rejects custom fields that do not belong to the user', async () => {
        vi.mocked(validateCustomFieldValues).mockResolvedValue({
            valid: false,
            error: 'Unknown custom field: field-other-user',
        });

        const res = response();
        await addManualAlbum(
            request({
                title: 'Kind of Blue',
                artist: 'Miles Davis',
                format: 'Vinyl',
                customFields: JSON.stringify({ 'field-other-user': 'x' }),
            }),
            res as never
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Unknown custom field: field-other-user' });
        expect(vi.mocked(Album)).not.toHaveBeenCalled();
    });

    it('replaces the custom fields of an edited manual album', async () => {
        vi.mocked(validateCustomFieldValues).mockResolvedValue({
            valid: true,
            sanitized: { 'field-1': 'Shelf C' },
        });

        const album = {
            isManual: true,
            title: 'Kind of Blue',
            artist: 'Miles Davis',
            year: '1959',
            save: vi.fn().mockResolvedValue(undefined),
        };
        const item = {
            _id: 'item-1',
            album,
            format: { name: 'Vinyl' },
            customFields: new Map([['field-1', 'Shelf A'], ['field-2', 'Old note']]),
            mediaCondition: null,
            sleeveCondition: null,
            save: vi.fn().mockResolvedValue(undefined),
        };

        vi.mocked(CollectionItem.findOne).mockReturnValue({
            populate: vi.fn().mockResolvedValue(item),
        } as never);
        vi.mocked(CollectionItem.findById).mockReturnValue({
            populate: vi.fn().mockResolvedValue(item),
        } as never);

        const res = response();
        await updateManualAlbum(
            {
                ...request({
                    customFields: JSON.stringify({ 'field-1': 'Shelf C' }),
                    mediaCondition: 'NM',
                    sleeveCondition: 'VG+',
                }),
                params: { itemId: 'item-1' }
            } as never,
            res as never
        );

        expect(item.customFields).toEqual(new Map([['field-1', 'Shelf C']]));
        expect(item.mediaCondition).toBe('NM');
        expect(item.sleeveCondition).toBe('VG+');
        expect(res.status).toHaveBeenCalledWith(200);
    });
});
