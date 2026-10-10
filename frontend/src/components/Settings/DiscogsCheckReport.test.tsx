import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DiscogsCheckReport from './DiscogsCheckReport';
import { getDiscogsReport, startDiscogsCheck } from '../../api/discogsSync';
import { toastService } from '../../utils/toast';
import type { DiscogsSyncReport } from '../../types/discogsAccount.types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options ? `${key}:${JSON.stringify(options)}` : key
    })
}));
vi.mock('../../api/discogsSync', () => ({
    getDiscogsReport: vi.fn(),
    startDiscogsCheck: vi.fn()
}));
vi.mock('../../utils/toast', () => ({ toastService: { success: vi.fn(), error: vi.fn() } }));

const report = (overrides: Partial<DiscogsSyncReport> = {}): DiscogsSyncReport => ({
    status: 'completed',
    startedAt: '2026-10-07T09:00:00Z',
    finishedAt: '2026-10-07T09:00:30Z',
    progress: { page: 2, pages: 2 },
    username: 'vinylfan',
    counts: { discogs: 150, matched: 148, newOnDiscogs: 0, merged: 0, onlyInMusivault: 0, dateDiffers: 0 },
    newOnDiscogs: [],
    merged: [],
    onlyInMusivault: [],
    ...overrides
});

describe('DiscogsCheckReport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('offers a check when none has run yet', async () => {
        vi.mocked(getDiscogsReport).mockResolvedValue(null);

        render(<DiscogsCheckReport />);

        expect(await screen.findByRole('button', { name: 'discogsCheck.checkNow' })).toBeEnabled();
        expect(screen.queryByText(/discogsCheck.lastChecked/)).not.toBeInTheDocument();
    });

    it('starts a check and then shows it running', async () => {
        vi.mocked(getDiscogsReport)
            .mockResolvedValueOnce(null)
            .mockResolvedValue(report({ status: 'running', progress: { page: 3, pages: 16 } }));
        vi.mocked(startDiscogsCheck).mockResolvedValue(undefined);

        render(<DiscogsCheckReport />);
        fireEvent.click(await screen.findByRole('button', { name: 'discogsCheck.checkNow' }));

        expect(startDiscogsCheck).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('discogsCheck.progress:{"page":3,"pages":16}')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'discogsCheck.checkNow' })).toBeDisabled();
    });

    it('tells the user when the check could not be started', async () => {
        vi.mocked(getDiscogsReport).mockResolvedValue(null);
        vi.mocked(startDiscogsCheck).mockRejectedValue(new Error('boom'));

        render(<DiscogsCheckReport />);
        fireEvent.click(await screen.findByRole('button', { name: 'discogsCheck.checkNow' }));

        await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('discogsCheck.startFailed'));
    });

    it('shows a waiting message while another check holds the queue', async () => {
        vi.mocked(getDiscogsReport).mockResolvedValue(report({ status: 'queued' }));

        render(<DiscogsCheckReport />);

        expect(await screen.findByText('discogsCheck.queued')).toBeInTheDocument();
    });

    it('keeps polling until the check finishes, then shows the result', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.mocked(getDiscogsReport)
            .mockResolvedValueOnce(report({ status: 'running', progress: { page: 1, pages: 2 } }))
            .mockResolvedValue(report({ counts: { discogs: 150, matched: 148, newOnDiscogs: 2, merged: 0, onlyInMusivault: 0, dateDiffers: 0 } }));

        render(<DiscogsCheckReport />);
        expect(await screen.findByText('discogsCheck.progress:{"page":1,"pages":2}')).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2100);
        });

        expect(await screen.findByText(/discogsCheck.summary/)).toBeInTheDocument();
        expect(getDiscogsReport).toHaveBeenCalledTimes(2);
        // Finished: no further polling.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });
        expect(getDiscogsReport).toHaveBeenCalledTimes(2);
    });

    it('says everything is in sync when nothing differs', async () => {
        vi.mocked(getDiscogsReport).mockResolvedValue(report());

        render(<DiscogsCheckReport />);

        expect(await screen.findByText('discogsCheck.inSync')).toBeInTheDocument();
        expect(screen.queryByText('discogsCheck.newTitle')).not.toBeInTheDocument();
        expect(screen.queryByText(/discogsCheck.dateDiffers/)).not.toBeInTheDocument();
    });

    it('lists each section that has entries, with its count, and hides the empty ones', async () => {
        vi.mocked(getDiscogsReport).mockResolvedValue(report({
            counts: { discogs: 150, matched: 146, newOnDiscogs: 1, merged: 1, onlyInMusivault: 0, dateDiffers: 3 },
            newOnDiscogs: [{
                releaseId: 1, instanceId: 11, artist: 'Nirvana', title: 'Nevermind', year: 1991, format: 'Vinyl', dateAdded: '2022-01-01T00:00:00Z'
            }],
            merged: [{
                item: { itemId: 'a', artist: 'Pink Floyd', title: 'The Wall' },
                release: { releaseId: 7, instanceId: 17, artist: 'Pink Floyd', title: 'The Wall', dateAdded: '2022-01-01T00:00:00Z' }
            }]
        }));

        render(<DiscogsCheckReport />);

        expect(await screen.findByText('discogsCheck.newTitle')).toBeInTheDocument();
        expect(screen.getByText('Nirvana')).toBeInTheDocument();
        expect(screen.getByText('discogsCheck.mergedTitle')).toBeInTheDocument();
        expect(screen.queryByText('discogsCheck.onlyTitle')).not.toBeInTheDocument();
        expect(screen.getByText('discogsCheck.dateDiffers:{"count":3}')).toBeInTheDocument();
        expect(screen.queryByText('discogsCheck.inSync')).not.toBeInTheDocument();
    });

    it('links each row to its release on Discogs, when it has one', async () => {
        vi.mocked(getDiscogsReport).mockResolvedValue(report({
            counts: { discogs: 150, matched: 146, newOnDiscogs: 1, merged: 0, onlyInMusivault: 2, dateDiffers: 0 },
            newOnDiscogs: [{
                releaseId: 1, instanceId: 11, artist: 'Nirvana', title: 'Nevermind', dateAdded: '2022-01-01T00:00:00Z'
            }],
            onlyInMusivault: [
                { itemId: 'a', artist: 'Daft Punk', title: 'Discovery', discogsId: 2879 },
                { itemId: 'b', artist: 'Manual Band', title: 'Demo' }
            ]
        }));

        render(<DiscogsCheckReport />);

        await screen.findByText('discogsCheck.newTitle');
        const links = screen.getAllByRole('link', { name: 'discogsCheck.openOnDiscogs' });
        expect(links.map(l => l.getAttribute('href'))).toEqual([
            'https://www.discogs.com/release/1',
            'https://www.discogs.com/release/2879'
        ]);
        expect(links[0]).toHaveAttribute('target', '_blank');
        expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('caps the rows shown and says how many more there are', async () => {
        const many = Array.from({ length: 120 }, (_, i) => ({
            itemId: String(i), artist: `Artist ${i}`, title: `Title ${i}`
        }));
        vi.mocked(getDiscogsReport).mockResolvedValue(report({
            counts: { discogs: 150, matched: 30, newOnDiscogs: 0, merged: 0, onlyInMusivault: 120, dateDiffers: 0 },
            onlyInMusivault: many
        }));

        render(<DiscogsCheckReport />);

        expect(await screen.findByText('discogsCheck.moreRows:{"count":20}')).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(100);
    });

    it('asks to reconnect when Discogs rejected the token during the check', async () => {
        vi.mocked(getDiscogsReport).mockResolvedValue(report({ status: 'error', errorCode: 'needsReconnect' }));

        render(<DiscogsCheckReport />);

        expect(await screen.findByRole('alert')).toHaveTextContent('discogsAccount.needsReconnect');
    });

    it('shows a generic failure for other errors', async () => {
        vi.mocked(getDiscogsReport).mockResolvedValue(report({ status: 'error', errorCode: 'failed' }));

        render(<DiscogsCheckReport />);

        expect(await screen.findByRole('alert')).toHaveTextContent('discogsCheck.failed');
    });
});
