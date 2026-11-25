import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AlbumDetailPage from './AlbumDetailPage';
import { getCollectionItem, removeFromCollection } from '../api/collection';
import { getCustomFields } from '../api/customFields';
import { getPreferences } from '../api/preferences';
import { useCollectionData } from '../hooks/collection/useCollectionData';
import { useLocation, useNavigate, useParams } from 'react-router';
import type { CollectionItem } from '../types/collection.types';

const refreshCollection = vi.fn();
const navigate = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-router', () => ({
    useParams: vi.fn(),
    useNavigate: vi.fn(),
    useLocation: vi.fn(),
}));
vi.mock('../api/collection', () => ({
    getCollectionItem: vi.fn(),
    syncItemPrice: vi.fn(),
    refreshItemFromDiscogs: vi.fn(),
    removeFromCollection: vi.fn(),
    ignoreFormatAlert: vi.fn(),
    restoreFormatAlert: vi.fn(),
    restoreDiscogsAlbum: vi.fn(),
}));
vi.mock('../api/preferences', () => ({ getPreferences: vi.fn() }));
vi.mock('../api/customFields', () => ({ getCustomFields: vi.fn() }));
vi.mock('../api/discogs', () => ({ getRelease: vi.fn() }));
vi.mock('../utils/toast', () => ({ toastService: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../hooks/collection/useCollectionData', () => ({ useCollectionData: vi.fn() }));
vi.mock('../hooks/useCurrency', () => ({
    useCurrency: () => ({
        formatValue: (value: number) => String(value),
        formatCompactValue: (value: number) => String(value),
        getValue: (value: number) => value,
        isLoading: false,
        rates: null,
        preferredCurrency: 'USD',
    }),
}));
vi.mock('../components/Common/CustomFieldsEditor', () => ({ default: () => null }));
vi.mock('../components/Modal/ManualAlbumEditModal', () => ({
    default: ({ mode }: { mode?: string }) => <div data-testid="edit-modal">{mode || 'manual'}</div>,
}));

const item: CollectionItem = {
    _id: 'item-1',
    album: {
        _id: 'album-1',
        title: 'Kind of Blue',
        artist: 'Miles Davis',
        cover_image: '/cover.jpg',
        thumb: '/thumb.jpg',
        year: '1959',
        isManual: true,
        genres: [],
        styles: [],
        tracklist: [],
        labels: [],
    },
    format: { name: 'Vinyl', descriptions: ['LP'], text: 'Vinyl LP' },
    addedAt: '2024-01-01T00:00:00.000Z',
};

describe('AlbumDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useLocation).mockReturnValue({
            pathname: '/app/album/item-1',
            search: '',
            state: null,
            key: 'default',
            hash: '',
        });
        vi.mocked(useParams).mockReturnValue({ itemId: 'item-1' });
        vi.mocked(useNavigate).mockReturnValue(navigate);
        vi.mocked(getCollectionItem).mockResolvedValue(item);
        vi.mocked(getPreferences).mockResolvedValue({} as never);
        vi.mocked(getCustomFields).mockResolvedValue([]);
        vi.mocked(removeFromCollection).mockResolvedValue(undefined);
        vi.mocked(useCollectionData).mockReturnValue({ refreshCollection } as never);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    });

    it('refreshes the shared collection after removing the item', async () => {
        render(<AlbumDetailPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'common.delete' }));

        await waitFor(() => expect(removeFromCollection).toHaveBeenCalledWith('item-1'));
        await waitFor(() => expect(refreshCollection).toHaveBeenCalledWith({ silent: true }));
        expect(navigate).toHaveBeenCalledWith('/app');
        expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
    });

    it('does not refresh the collection when the removal fails', async () => {
        vi.mocked(removeFromCollection).mockRejectedValue(new Error('network'));
        render(<AlbumDetailPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'common.delete' }));

        await waitFor(() => expect(removeFromCollection).toHaveBeenCalledWith('item-1'));
        expect(refreshCollection).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('opens the Discogs edit form automatically when custom fields exist', async () => {
        vi.mocked(useLocation).mockReturnValue({
            pathname: '/app/album/item-1',
            search: '?edit=discogs',
            state: null,
            key: 'default',
            hash: '',
        });
        vi.mocked(getCustomFields).mockResolvedValue([
            {
                _id: 'field-1',
                name: 'Shelf',
                type: 'text',
                order: 1,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
            },
        ]);
        render(<AlbumDetailPage />);

        expect(await screen.findByTestId('edit-modal')).toHaveTextContent('discogs');
        await waitFor(() => expect(navigate).toHaveBeenCalledWith(
            '/app/album/item-1',
            { replace: true, state: null }
        ));
    });

    it('shows the detail view when arriving with ?edit=discogs and no custom fields exist', async () => {
        vi.mocked(useLocation).mockReturnValue({
            pathname: '/app/album/item-1',
            search: '?edit=discogs',
            state: null,
            key: 'default',
            hash: '',
        });
        render(<AlbumDetailPage />);

        expect(await screen.findByText('Kind of Blue')).toBeInTheDocument();
        expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
        await waitFor(() => expect(navigate).toHaveBeenCalledWith(
            '/app/album/item-1',
            { replace: true, state: null }
        ));
    });

    it('shows the detail view when the custom field lookup fails', async () => {
        vi.mocked(useLocation).mockReturnValue({
            pathname: '/app/album/item-1',
            search: '?edit=discogs',
            state: null,
            key: 'default',
            hash: '',
        });
        vi.mocked(getCustomFields).mockRejectedValue(new Error('network'));
        render(<AlbumDetailPage />);

        expect(await screen.findByText('Kind of Blue')).toBeInTheDocument();
        expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
    });
});

describe('AlbumDetailPage value label', () => {
    const discogsItem = (extra: Partial<CollectionItem>): CollectionItem => ({
        ...item,
        album: { ...item.album, isManual: false, discogsId: 123 },
        ...extra,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useParams).mockReturnValue({ itemId: 'item-1' });
        vi.mocked(useNavigate).mockReturnValue(navigate);
        vi.mocked(getPreferences).mockResolvedValue({} as never);
        vi.mocked(useCollectionData).mockReturnValue({ refreshCollection } as never);
    });

    it('says the value is manual on a Discogs album that has one', async () => {
        vi.mocked(getCollectionItem).mockResolvedValue(discogsItem({ manualValue: 500 }));
        render(<AlbumDetailPage />);

        expect(await screen.findByText('album.manualValue')).toBeInTheDocument();
        expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('shows the Discogs price next to a manual value, so a stale one can be spotted', async () => {
        vi.mocked(getCollectionItem).mockResolvedValue(discogsItem({
            manualValue: 200,
            mediaCondition: 'VG+',
            priceCache: { veryGoodPlus: 500, currency: 'USD' } as never,
        }));
        render(<AlbumDetailPage />);

        expect(await screen.findByText('album.manualValue', { exact: false })).toHaveTextContent('album.discogsPrice 500');
        // The manual value still counts, not the Discogs price.
        expect(screen.getByText('200')).toBeInTheDocument();
    });

    it('shows no Discogs price beside a manual value when Discogs has none', async () => {
        vi.mocked(getCollectionItem).mockResolvedValue(discogsItem({ manualValue: 200 }));
        render(<AlbumDetailPage />);

        expect(await screen.findByText('album.manualValue')).toBeInTheDocument();
        expect(screen.queryByText('album.discogsPrice', { exact: false })).not.toBeInTheDocument();
    });

    it('keeps the Discogs price label when no value was entered by hand', async () => {
        vi.mocked(getCollectionItem).mockResolvedValue(discogsItem({ manualValue: null }));
        render(<AlbumDetailPage />);

        expect(await screen.findByText('stats.value')).toBeInTheDocument();
        expect(screen.queryByText('album.manualValue')).not.toBeInTheDocument();
    });
});
