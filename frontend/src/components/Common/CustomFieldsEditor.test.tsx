import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomFieldsEditor from './CustomFieldsEditor';
import { getCustomFields } from '../../api/customFields';
import { updateCollectionItem } from '../../api/collection';
import type { CustomFieldDefinition } from '../../types/customFields.types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../api/customFields', () => ({ getCustomFields: vi.fn() }));
vi.mock('../../api/collection', () => ({ updateCollectionItem: vi.fn() }));
vi.mock('../../utils/toast', () => ({ toastService: { success: vi.fn(), error: vi.fn() } }));

const fields: CustomFieldDefinition[] = [
    {
        _id: 'field-binder',
        name: 'Binder',
        type: 'text',
        placeholder: 'Shelf A',
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
    },
];

describe('CustomFieldsEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCustomFields).mockResolvedValue(fields);
    });

    it('shows values without inputs or a save button in read-only mode', async () => {
        render(
            <CustomFieldsEditor
                itemId="item-1"
                values={{ 'field-binder': 'Shelf 3' }}
                onUpdate={vi.fn()}
                readOnly
            />
        );

        expect(await screen.findByText('Shelf 3')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Shelf A')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'common.save' })).not.toBeInTheDocument();
        expect(updateCollectionItem).not.toHaveBeenCalled();
    });

    it('keeps the inputs in editable mode', async () => {
        render(
            <CustomFieldsEditor
                itemId="item-1"
                values={{ 'field-binder': 'Shelf 3' }}
                onUpdate={vi.fn()}
            />
        );

        expect(await screen.findByPlaceholderText('Shelf A')).toHaveValue('Shelf 3');
    });
});
