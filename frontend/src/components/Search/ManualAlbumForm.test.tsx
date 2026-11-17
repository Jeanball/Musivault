import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManualAlbumForm from './ManualAlbumForm';
import { addManualAlbum, updateDiscogsAlbum, updateManualAlbum } from '../../api/collection';
import { getCustomFields } from '../../api/customFields';
import type { CollectionItem } from '../../types/collection.types';
import type { CustomFieldDefinition } from '../../types/customFields.types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
        i18n: { language: 'en' },
    }),
}));

vi.mock('../../api/collection', () => ({
    addManualAlbum: vi.fn(),
    updateDiscogsAlbum: vi.fn(),
    updateManualAlbum: vi.fn(),
}));

vi.mock('../../api/customFields', () => ({
    getCustomFields: vi.fn(),
}));

vi.mock('../../utils/toast', () => ({
    toastService: { success: vi.fn(), error: vi.fn() },
}));

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
    {
        _id: 'field-notes',
        name: 'Notes',
        type: 'textarea',
        placeholder: 'Anything worth remembering',
        order: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
    },
];

const manualItem = (customFields: Record<string, string>): CollectionItem => ({
    _id: 'item-1',
    album: {
        _id: 'album-1',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        cover_image: '',
        thumb: '',
        year: '1959',
        styles: [],
        labels: [],
    },
    format: { name: 'Vinyl', descriptions: [], text: 'Vinyl' },
    customFields,
    addedAt: '2024-01-02T00:00:00.000Z',
});

const customFieldsFrom = (form: FormData) => {
    const raw = form.get('customFields');
    return raw ? JSON.parse(String(raw)) : undefined;
};

describe('ManualAlbumForm custom fields', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCustomFields).mockResolvedValue(fields);
        vi.mocked(addManualAlbum).mockResolvedValue({ item: manualItem({}) } as never);
    });

    it('saves the filled custom fields when adding an album', async () => {
        const created = manualItem({ 'field-binder': 'Shelf 3' });
        vi.mocked(addManualAlbum).mockResolvedValue({ item: created } as never);
        const onSaved = vi.fn();
        render(<ManualAlbumForm onSaved={onSaved} />);

        expect(await screen.findByText('Binder')).toBeInTheDocument();
        expect(screen.getByText('Notes')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('search.albumPlaceholder'), {
            target: { value: 'Kind of Blue' },
        });
        fireEvent.change(screen.getByPlaceholderText('search.artistPlaceholder'), {
            target: { value: 'Miles Davis' },
        });
        fireEvent.change(screen.getByPlaceholderText('Shelf A'), {
            target: { value: ' Shelf 3 ' },
        });
        fireEvent.change(screen.getByPlaceholderText('Anything worth remembering'), {
            target: { value: '   ' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'common.add' }));

        await waitFor(() => expect(addManualAlbum).toHaveBeenCalledTimes(1));
        const form = vi.mocked(addManualAlbum).mock.calls[0][0];
        expect(customFieldsFrom(form)).toEqual({ 'field-binder': 'Shelf 3' });
        // The search page uses this callback to refresh the collection list.
        expect(onSaved).toHaveBeenCalledWith(created);
    });

    it('saves genres and styles picked from the Discogs lists', async () => {
        const onSaved = vi.fn();
        render(<ManualAlbumForm onSaved={onSaved} />);

        await screen.findByText('Binder');

        fireEvent.change(screen.getByPlaceholderText('search.albumPlaceholder'), {
            target: { value: 'Kind of Blue' },
        });
        fireEvent.change(screen.getByPlaceholderText('search.artistPlaceholder'), {
            target: { value: 'Miles Davis' },
        });

        const genresInput = screen.getByPlaceholderText('search.genresPlaceholder');
        fireEvent.focus(genresInput);
        fireEvent.change(genresInput, { target: { value: 'Jazz' } });
        fireEvent.click(screen.getByRole('button', { name: 'Jazz' }));

        const stylesInput = screen.getByPlaceholderText('search.stylesPlaceholder');
        fireEvent.focus(stylesInput);
        fireEvent.change(stylesInput, { target: { value: 'Hard Bop' } });
        fireEvent.click(screen.getByRole('button', { name: 'Hard Bop' }));

        fireEvent.click(screen.getByRole('button', { name: 'common.add' }));

        await waitFor(() => expect(addManualAlbum).toHaveBeenCalledTimes(1));
        const form = vi.mocked(addManualAlbum).mock.calls[0][0];
        expect(form.get('genres')).toBe('Jazz');
        expect(form.get('styles')).toBe('Hard Bop');
    });

    it('offers every style before a genre is picked, then only that genre’s styles', async () => {
        render(<ManualAlbumForm onSaved={vi.fn()} />);

        await screen.findByText('Binder');

        const stylesInput = screen.getByPlaceholderText('search.stylesPlaceholder');
        fireEvent.change(stylesInput, { target: { value: 'Black Metal' } });
        expect(screen.getByRole('button', { name: 'Black Metal' })).toBeInTheDocument();

        const genresInput = screen.getByPlaceholderText('search.genresPlaceholder');
        fireEvent.focus(genresInput);
        fireEvent.change(genresInput, { target: { value: 'Jazz' } });
        fireEvent.click(screen.getByRole('button', { name: 'Jazz' }));

        expect(screen.queryByRole('button', { name: 'Black Metal' })).not.toBeInTheDocument();

        fireEvent.change(stylesInput, { target: { value: 'Hard Bop' } });
        expect(screen.getByRole('button', { name: 'Hard Bop' })).toBeInTheDocument();
    });

    it('drops a style that no longer fits when the genre changes', async () => {
        render(<ManualAlbumForm onSaved={vi.fn()} />);

        await screen.findByText('Binder');

        const genresInput = screen.getByPlaceholderText('search.genresPlaceholder');
        fireEvent.focus(genresInput);
        fireEvent.change(genresInput, { target: { value: 'Jazz' } });
        fireEvent.click(screen.getByRole('button', { name: 'Jazz' }));

        const stylesInput = screen.getByPlaceholderText('search.stylesPlaceholder');
        fireEvent.focus(stylesInput);
        fireEvent.change(stylesInput, { target: { value: 'Hard Bop' } });
        fireEvent.click(screen.getByRole('button', { name: 'Hard Bop' }));
        fireEvent.keyDown(stylesInput, { key: 'Escape' });
        expect(screen.getByText('Hard Bop')).toBeInTheDocument();

        fireEvent.click(screen.getAllByRole('button', { name: 'search.removeValue' })[0]);
        fireEvent.change(genresInput, { target: { value: 'Rock' } });
        fireEvent.click(screen.getByRole('button', { name: 'Rock' }));

        expect(screen.queryByText('Hard Bop')).not.toBeInTheDocument();
    });

    it('shows the saved values when editing an album', async () => {
        vi.mocked(updateManualAlbum).mockResolvedValue({
            item: manualItem({ 'field-binder': 'Shelf B', 'field-notes': 'First pressing' }),
        } as never);

        render(
            <ManualAlbumForm item={manualItem({ 'field-binder': 'Shelf B', 'field-notes': 'First pressing' })} />
        );

        await screen.findByText('Binder');
        expect(screen.getByPlaceholderText('Shelf A')).toHaveValue('Shelf B');
        expect(screen.getByPlaceholderText('Anything worth remembering')).toHaveValue('First pressing');

        fireEvent.change(screen.getByPlaceholderText('Shelf A'), {
            target: { value: 'Shelf C' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

        await waitFor(() => expect(updateManualAlbum).toHaveBeenCalledTimes(1));
        const form = vi.mocked(updateManualAlbum).mock.calls[0][1];
        expect(customFieldsFrom(form)).toEqual({
            'field-binder': 'Shelf C',
            'field-notes': 'First pressing',
        });
    });

    it('lets the format be edited on a Discogs album', async () => {
        const item: CollectionItem = {
            ...manualItem({}),
            album: { ...manualItem({}).album, isManual: false, discogsId: 123 },
        };
        vi.mocked(updateDiscogsAlbum).mockResolvedValue({ item } as never);
        const { container } = render(<ManualAlbumForm item={item} mode="discogs" onSaved={vi.fn()} />);

        const select = container.querySelector('select') as HTMLSelectElement;
        expect(select).not.toBeDisabled();
        expect(Array.from(select.options).map(option => option.value)).toEqual(['Vinyl', 'CD', 'Cassette']);

        fireEvent.change(select, { target: { value: 'CD' } });
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

        await waitFor(() => expect(updateDiscogsAlbum).toHaveBeenCalledTimes(1));
        const [itemId, form] = vi.mocked(updateDiscogsAlbum).mock.calls[0];
        expect(itemId).toBe('item-1');
        expect(form.get('format')).toBe('CD');
    });

    it('keeps a Discogs format outside the manual list available', async () => {
        const item: CollectionItem = {
            ...manualItem({}),
            format: { name: 'File', descriptions: [], text: 'File' },
        };
        vi.mocked(updateDiscogsAlbum).mockResolvedValue({ item } as never);
        const { container } = render(<ManualAlbumForm item={item} mode="discogs" onSaved={vi.fn()} />);

        const select = container.querySelector('select') as HTMLSelectElement;
        expect(select.value).toBe('File');
        expect(Array.from(select.options).filter(option => option.value === 'File')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

        await waitFor(() => expect(updateDiscogsAlbum).toHaveBeenCalledTimes(1));
        const [, form] = vi.mocked(updateDiscogsAlbum).mock.calls[0];
        expect(form.get('format')).toBe('File');
    });

    it('loads and saves custom fields on a Discogs album', async () => {
        const item: CollectionItem = {
            ...manualItem({ 'field-binder': 'Shelf 1' }),
            album: { ...manualItem({}).album, isManual: false, discogsId: 123 },
        };
        vi.mocked(updateDiscogsAlbum).mockResolvedValue({ item } as never);
        render(<ManualAlbumForm item={item} mode="discogs" onSaved={vi.fn()} />);

        const input = await screen.findByPlaceholderText('Shelf A');
        expect(input).toHaveValue('Shelf 1');

        fireEvent.change(input, { target: { value: 'Shelf 4' } });
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

        await waitFor(() => expect(updateDiscogsAlbum).toHaveBeenCalledTimes(1));
        const [, form] = vi.mocked(updateDiscogsAlbum).mock.calls[0];
        expect(customFieldsFrom(form)).toEqual({ 'field-binder': 'Shelf 4' });
    });

    it('edits the condition grades in the form when enabled', async () => {
        const item: CollectionItem = {
            ...manualItem({}),
            album: { ...manualItem({}).album, isManual: false, discogsId: 123 },
            mediaCondition: 'VG+',
            sleeveCondition: 'VG',
        };
        vi.mocked(updateDiscogsAlbum).mockResolvedValue({ item } as never);
        render(<ManualAlbumForm item={item} mode="discogs" showConditions onSaved={vi.fn()} />);

        const media = screen.getByLabelText(/condition\.media/) as HTMLSelectElement;
        const sleeve = screen.getByLabelText(/condition\.sleeve/) as HTMLSelectElement;
        expect(media.value).toBe('VG+');
        expect(sleeve.value).toBe('VG');

        fireEvent.change(media, { target: { value: 'NM' } });
        fireEvent.change(sleeve, { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

        await waitFor(() => expect(updateDiscogsAlbum).toHaveBeenCalledTimes(1));
        const [, form] = vi.mocked(updateDiscogsAlbum).mock.calls[0];
        expect(form.get('mediaCondition')).toBe('NM');
        expect(form.get('sleeveCondition')).toBe('');
    });
});
