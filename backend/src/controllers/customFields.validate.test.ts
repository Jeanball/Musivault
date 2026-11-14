import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCustomFieldValues } from './customFields.controller';
import CustomFieldDefinition from '../models/CustomFieldDefinition';

vi.mock('../config/logger.config', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../models/CustomFieldDefinition', () => ({ default: { find: vi.fn() } }));
vi.mock('../models/CollectionItem', () => ({ default: {} }));

describe('validateCustomFieldValues', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects a malformed field id without querying the database', async () => {
        const result = await validateCustomFieldValues('user-1', { 'unknown-field': 'x' });

        expect(result).toEqual({ valid: false, error: 'Unknown custom field: unknown-field' });
        expect(vi.mocked(CustomFieldDefinition.find)).not.toHaveBeenCalled();
    });

    it('rejects a field that belongs to another user', async () => {
        vi.mocked(CustomFieldDefinition.find).mockResolvedValue([] as never);

        const result = await validateCustomFieldValues('user-1', {
            '6af5f36cca5e34dc3085fd82': 'Shelf A',
        });

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Unknown custom field: 6af5f36cca5e34dc3085fd82');
    });

    it('trims the values of the fields the user owns', async () => {
        vi.mocked(CustomFieldDefinition.find).mockResolvedValue([
            { _id: '6af5f36cca5e34dc3085fd82', name: 'Binder', toString: () => '6af5f36cca5e34dc3085fd82' },
        ] as never);

        const result = await validateCustomFieldValues('user-1', {
            '6af5f36cca5e34dc3085fd82': '  Shelf A  ',
        });

        expect(result).toEqual({
            valid: true,
            sanitized: { '6af5f36cca5e34dc3085fd82': 'Shelf A' },
        });
    });
});
