import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AlbumDetailPage from './AlbumDetailPage';
import { getCollectionItem, removeFromCollection } from '../api/collection';
import { getPreferences } from '../api/preferences';
import { useCollectionData } from '../hooks/collection/useCollectionData';
import { useNavigate, useParams } from 'react-router';
import type { CollectionItem } from '../types/collection.types';

const refreshCollection = vi.fn();
const navigate = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-router', () => ({
    useParams: vi.fn(),
    useNavigate: vi.fn(),
    useLocation: () => ({ state: null }),
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

describe('AlbumDetailPage delete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useParams).mockReturnValue({ itemId: 'item-1' });
        vi.mocked(useNavigate).mockReturnValue(navigate);
        vi.mocked(getCollectionItem).mockResolvedValue(item);
        vi.mocked(getPreferences).mockResolvedValue({} as never);
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
    });

    it('does not refresh the collection when the removal fails', async () => {
        vi.mocked(removeFromCollection).mockRejectedValue(new Error('network'));
        render(<AlbumDetailPage />);

        fireEvent.click(await screen.findByRole('button', { name: 'common.delete' }));

        await waitFor(() => expect(removeFromCollection).toHaveBeenCalledWith('item-1'));
        expect(refreshCollection).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
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
