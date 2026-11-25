import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReleasePage from './ReleasePage';
import { addToCollection } from '../api/collection';
import { getRelease } from '../api/discogs';
import { useCollectionData } from '../hooks/collection/useCollectionData';
import { getPreferences } from '../api/preferences';
import { useNavigate, useParams } from 'react-router';
import type { AlbumDetails } from '../types/album.types';

const navigate = vi.fn();

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router', () => ({
    useParams: vi.fn(),
    useNavigate: vi.fn(),
}));
vi.mock('../api/discogs', () => ({ getRelease: vi.fn() }));
vi.mock('../api/collection', () => ({ addToCollection: vi.fn() }));
vi.mock('../api/preferences', () => ({ getPreferences: vi.fn() }));
vi.mock('../hooks/collection/useCollectionData', () => ({ useCollectionData: vi.fn() }));
vi.mock('../hooks/useReleasePrice', () => ({ useReleasePrice: () => ({ price: 10, isLoading: false }) }));
vi.mock('../utils/toast', () => ({ toastService: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/Modal/ConfirmAddModal', () => ({
    default: ({ isOpen, onConfirm }: { isOpen: boolean; onConfirm: (m: string | null, s: string | null) => void }) =>
        isOpen ? <button onClick={() => onConfirm(null, null)}>confirm-add</button> : null,
}));
vi.mock('../components/Common/BackButton', () => ({ default: () => null }));
vi.mock('../components/Common/PageLoadError', () => ({ default: () => null }));

const album: AlbumDetails = {
    discogsId: 123,
    title: 'Kind of Blue',
    artist: 'Miles Davis',
    year: '1959',
    thumb: '/thumb.jpg',
    cover_image: '/cover.jpg',
    availableFormats: [{ name: 'Vinyl', descriptions: ['LP'], text: 'Vinyl LP' }],
};

describe('ReleasePage add', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useParams).mockReturnValue({ releaseId: '123' });
        vi.mocked(useNavigate).mockReturnValue(navigate);
        vi.mocked(getRelease).mockResolvedValue(album);
        vi.mocked(getPreferences).mockResolvedValue({} as never);
        vi.mocked(addToCollection).mockResolvedValue({ item: { _id: 'item-9' } } as never);
        vi.mocked(useCollectionData).mockReturnValue({ refreshCollection: vi.fn() } as never);
    });

    it('opens the edit form for the newly added Discogs album', async () => {
        render(<ReleasePage />);

        fireEvent.click(await screen.findByRole('button', { name: /Vinyl/ }));
        fireEvent.click(await screen.findByRole('button', { name: 'confirm-add' }));

        await waitFor(() => expect(addToCollection).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/album/item-9?edit=discogs'));
    });

    it('stays on the page when the add fails', async () => {
        vi.mocked(addToCollection).mockRejectedValue(new Error('duplicate'));
        render(<ReleasePage />);

        fireEvent.click(await screen.findByRole('button', { name: /Vinyl/ }));
        fireEvent.click(await screen.findByRole('button', { name: 'confirm-add' }));

        await waitFor(() => expect(addToCollection).toHaveBeenCalledTimes(1));
        expect(navigate).not.toHaveBeenCalled();
    });
});
