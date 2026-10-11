import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Navbar from './Navbar';
import { useDiscogsPending } from '../../context/DiscogsPendingContext';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, options?: unknown) => (typeof options === 'object' ? `${key}:${JSON.stringify(options)}` : key) })
}));
vi.mock('../../context/DiscogsPendingContext', () => ({ useDiscogsPending: vi.fn() }));

const pending = (count: number) => ({
    newOnDiscogs: count, merged: 0, count, showNotice: false, dismissNotice: vi.fn(), refresh: vi.fn()
});
const renderNavbar = () => render(<MemoryRouter><Navbar username="alex" isAdmin={false} onLogout={vi.fn()} /></MemoryRouter>);

describe('Navbar Discogs badge', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows the number of changes waiting next to Settings, in both menus', () => {
        vi.mocked(useDiscogsPending).mockReturnValue(pending(4));

        renderNavbar();

        expect(screen.getAllByLabelText('discogsPending.badge:{"count":4}')).toHaveLength(2);
    });

    it('keeps showing it while the notice is dismissed: it follows what is left to do', () => {
        vi.mocked(useDiscogsPending).mockReturnValue({ ...pending(4), showNotice: false });

        renderNavbar();

        expect(screen.getAllByLabelText(/discogsPending.badge/).length).toBeGreaterThan(0);
    });

    it('shows no badge when nothing is waiting', () => {
        vi.mocked(useDiscogsPending).mockReturnValue(pending(0));

        renderNavbar();

        expect(screen.queryByLabelText(/discogsPending.badge/)).not.toBeInTheDocument();
    });
});
