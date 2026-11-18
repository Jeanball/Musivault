import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createCustomFieldDefinition,
    updateCustomFieldDefinition
} from './customFields.controller';
import CustomFieldDefinition from '../models/CustomFieldDefinition';

vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../models/CollectionItem', () => ({ default: {} }));

vi.mock('../models/CustomFieldDefinition', () => {
    const countDocuments = vi.fn();
    const findOne = vi.fn();
    const model = vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
        Object.assign(this, data, { save: vi.fn().mockResolvedValue(undefined) });
    });
    Object.assign(model, { countDocuments, findOne });
    return {
        default: model,
        CUSTOM_FIELD_DEFAULT_TABLE_WIDTH_REM: 9,
        CUSTOM_FIELD_MIN_TABLE_WIDTH_REM: 4,
        CUSTOM_FIELD_MAX_TABLE_WIDTH_REM: 24,
    };
});

const response = () => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return res;
};

const request = (body: Record<string, unknown>, params: Record<string, string> = {}) =>
    ({ user: { _id: 'user-1' }, body, params } as never);

const chain = (value: unknown) => ({
    sort: () => chain(value),
    select: async () => value,
});

describe('custom field table width', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(CustomFieldDefinition.countDocuments).mockResolvedValue(0 as never);
    });

    it('saves the width chosen for a short text field', async () => {
        vi.mocked(CustomFieldDefinition.findOne)
            .mockResolvedValueOnce(null as never)
            .mockReturnValueOnce(chain({ order: 2 }) as never);

        const res = response();
        await createCustomFieldDefinition(
            request({ name: 'Shelf', type: 'text', placeholder: 'Shelf A', tableWidthRem: 6 }),
            res as never
        );

        expect(vi.mocked(CustomFieldDefinition)).toHaveBeenCalledWith(
            expect.objectContaining({ tableWidthRem: 6 })
        );
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('defaults the width when the form does not send one', async () => {
        vi.mocked(CustomFieldDefinition.findOne)
            .mockResolvedValueOnce(null as never)
            .mockReturnValueOnce(chain({ order: 0 }) as never);

        await createCustomFieldDefinition(
            request({ name: 'Shelf', type: 'text' }),
            response() as never
        );

        expect(vi.mocked(CustomFieldDefinition)).toHaveBeenCalledWith(
            expect.objectContaining({ tableWidthRem: 9 })
        );
    });

    it('rejects a width outside the allowed range', async () => {
        const res = response();
        await createCustomFieldDefinition(
            request({ name: 'Shelf', type: 'text', tableWidthRem: 99 }),
            res as never
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(vi.mocked(CustomFieldDefinition)).not.toHaveBeenCalled();
    });

    it('updates the stored width of an existing field', async () => {
        const field = {
            name: 'Shelf',
            type: 'text',
            placeholder: '',
            tableWidthRem: 9,
            save: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(CustomFieldDefinition.findOne).mockResolvedValue(field as never);

        const res = response();
        await updateCustomFieldDefinition(
            request({ tableWidthRem: 12 }, { fieldId: 'field-1' }),
            res as never
        );

        expect(field.tableWidthRem).toBe(12);
        expect(field.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects an invalid width on update without saving', async () => {
        const field = {
            name: 'Shelf',
            type: 'text',
            tableWidthRem: 9,
            save: vi.fn().mockResolvedValue(undefined),
        };
        vi.mocked(CustomFieldDefinition.findOne).mockResolvedValue(field as never);

        const res = response();
        await updateCustomFieldDefinition(
            request({ tableWidthRem: 1 }, { fieldId: 'field-1' }),
            res as never
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(field.save).not.toHaveBeenCalled();
    });
});
