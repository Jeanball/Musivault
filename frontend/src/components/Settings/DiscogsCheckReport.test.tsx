import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DiscogsCheckReport from './DiscogsCheckReport';
import { applyDiscogsSelection, getDiscogsReport, startDiscogsCheck, stopDiscogsApply } from '../../api/discogsSync';
import { toastService } from '../../utils/toast';
import type { DiscogsApply, DiscogsSyncReport } from '../../types/discogsAccount.types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options ? `${key}:${JSON.stringify(options)}` : key
    })
}));
const { refreshCollection, refreshPending } = vi.hoisted(() => ({ refreshCollection: vi.fn(), refreshPending: vi.fn() }));
vi.mock('../../api/discogsSync', () => ({
    getDiscogsReport: vi.fn(),
    startDiscogsCheck: vi.fn(),
    applyDiscogsSelection: vi.fn(),
    stopDiscogsApply: vi.fn()
}));
vi.mock('../../hooks/collection/useCollectionData', () => ({
    useCollectionData: () => ({ refreshCollection })
}));
vi.mock('../../context/DiscogsPendingContext', () => ({
    useDiscogsPending: () => ({ refresh: refreshPending })
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

    it('re-reads the navbar badge when a check finishes, and not before', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.mocked(getDiscogsReport)
            .mockResolvedValueOnce(report({ status: 'running', progress: { page: 1, pages: 2 } }))
            .mockResolvedValue(report());

        render(<DiscogsCheckReport />);
        await screen.findByText('discogsCheck.progress:{"page":1,"pages":2}');
        expect(refreshPending).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2100);
        });

        await waitFor(() => expect(refreshPending).toHaveBeenCalledTimes(1));
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
                release: { releaseId: 7, instanceId: 17, artist: 'Pink Floyd', title: 'The Wall', dateAdded: '2022-01-01T00:00:00Z' },
                match: 'guess'
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

    describe('applying', () => {
        const drift = (overrides: Partial<DiscogsSyncReport> = {}) => report({
            counts: { discogs: 150, matched: 144, newOnDiscogs: 2, merged: 2, onlyInMusivault: 1, dateDiffers: 5 },
            newOnDiscogs: [
                { releaseId: 1, instanceId: 11, artist: 'Nirvana', title: 'Nevermind', dateAdded: '2022-01-01T00:00:00Z' },
                { releaseId: 2, instanceId: 12, artist: 'Slayer', title: 'Reign In Blood', dateAdded: '2022-01-01T00:00:00Z' }
            ],
            merged: [
                {
                    item: { itemId: 'a', artist: 'Pink Floyd', title: 'The Wall' },
                    release: { releaseId: 7, instanceId: 17, artist: 'Pink Floyd', title: 'The Wall', dateAdded: '2022-01-01T00:00:00Z' },
                    match: 'instance'
                },
                {
                    item: { itemId: 'b', artist: 'Obituary', title: 'Cause Of Death' },
                    release: { releaseId: 8, instanceId: 18, artist: 'Obituary', title: 'Cause Of Death', dateAdded: '2022-01-01T00:00:00Z' },
                    match: 'guess'
                }
            ],
            onlyInMusivault: [{ itemId: 'c', artist: 'Manual Band', title: 'Demo' }],
            ...overrides
        });
        const apply = (overrides: Partial<DiscogsApply> = {}): DiscogsApply => ({
            status: 'running', phase: 'records', startedAt: '2026-10-07T09:05:00Z', total: 4, done: 1,
            added: 1, relinked: 0, skipped: 0, failed: 0, useDiscogsDates: false, datesUpdated: 0, instanceIdsStored: 0,
            failures: [],
            ...overrides
        });
        const applyButton = (name: string) => screen.findByRole('button', { name: new RegExp(`^${name}`) });

        beforeEach(() => {
            vi.mocked(applyDiscogsSelection).mockResolvedValue(undefined);
        });

        it('ticks every new and merged row, and none of the rows that are only in Musivault', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());

            render(<DiscogsCheckReport />);

            await screen.findByText('discogsCheck.newTitle');
            const boxes = screen.getAllByRole('checkbox');
            expect(boxes).toHaveLength(4);
            boxes.forEach(box => expect(box).toBeChecked());
            expect(screen.getByText('Manual Band').closest('li')?.querySelector('input')).toBeNull();
        });

        it('applies exactly the ticked rows, and not the dates', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());

            render(<DiscogsCheckReport />);
            await screen.findByText('discogsCheck.newTitle');
            fireEvent.click(screen.getByRole('checkbox', { name: 'Slayer — Reign In Blood' }));
            fireEvent.click(screen.getByRole('checkbox', { name: 'Obituary — Cause Of Death' }));
            fireEvent.click(await applyButton('discogsApply.applySelected'));

            await waitFor(() => expect(applyDiscogsSelection).toHaveBeenCalledWith({
                add: [1],
                relink: [{ itemId: 'a', releaseId: 7 }],
                useDiscogsDates: false
            }));
        });

        it('unticks and reticks a whole section', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());

            render(<DiscogsCheckReport />);
            await screen.findByText('discogsCheck.newTitle');
            fireEvent.click(screen.getAllByRole('button', { name: 'discogsApply.selectNone' })[0]);

            expect(screen.getByRole('checkbox', { name: 'Nirvana — Nevermind' })).not.toBeChecked();
            expect(screen.getByRole('checkbox', { name: 'Pink Floyd — The Wall' })).toBeChecked();

            fireEvent.click(screen.getAllByRole('button', { name: 'discogsApply.selectAll' })[0]);
            expect(screen.getByRole('checkbox', { name: 'Nirvana — Nevermind' })).toBeChecked();
        });

        it('ticks every row again when a new result arrives', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            vi.mocked(getDiscogsReport)
                .mockResolvedValueOnce(drift({ apply: apply() }))
                .mockResolvedValue(drift({ finishedAt: '2026-10-07T10:00:00Z', apply: apply({ status: 'completed' }) }));

            render(<DiscogsCheckReport />);
            await screen.findByText('discogsCheck.newTitle');
            fireEvent.click(screen.getByRole('checkbox', { name: 'Nirvana — Nevermind' }));
            expect(screen.getByRole('checkbox', { name: 'Nirvana — Nevermind' })).not.toBeChecked();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2100);
            });

            await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Nirvana — Nevermind' })).toBeChecked());
        });

        it('cannot apply with nothing ticked', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());

            render(<DiscogsCheckReport />);
            await screen.findByText('discogsCheck.newTitle');
            screen.getAllByRole('checkbox').forEach(box => fireEvent.click(box));

            expect(await applyButton('discogsApply.applySelected')).toBeDisabled();
        });

        it('says whether a merge is confirmed or only likely', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());

            render(<DiscogsCheckReport />);

            expect(await screen.findByText(/The Wall/)).toHaveTextContent('discogsCheck.mergedExact');
            expect(screen.getByText(/Cause Of Death/)).toHaveTextContent('discogsCheck.mergedLikely');
        });

        it('asks before applying everything, and then applies even the unticked rows', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());

            render(<DiscogsCheckReport />);
            await screen.findByText('discogsCheck.newTitle');
            fireEvent.click(screen.getByRole('checkbox', { name: 'Slayer — Reign In Blood' }));
            fireEvent.click(await applyButton('discogsApply.applyAll'));

            expect(applyDiscogsSelection).not.toHaveBeenCalled();
            expect(screen.getByText('discogsApply.confirmAllBody:{"added":2,"relinked":2}')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'discogsApply.confirm' }));

            await waitFor(() => expect(applyDiscogsSelection).toHaveBeenCalledWith({
                add: [1, 2],
                relink: [{ itemId: 'a', releaseId: 7 }, { itemId: 'b', releaseId: 8 }],
                useDiscogsDates: false
            }));
        });

        describe('large applies', () => {
            const many = (count: number) => drift({
                counts: { discogs: 2000, matched: 10, newOnDiscogs: count, merged: 0, onlyInMusivault: 0, dateDiffers: 0 },
                newOnDiscogs: Array.from({ length: count }, (_, i) => ({
                    releaseId: i + 1, instanceId: i + 1000, artist: `Artist ${i}`, title: `Title ${i}`, dateAdded: '2022-01-01T00:00:00Z'
                })),
                merged: []
            });

            it('says how many rows are not shown, and shows them all on request, still ticked', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(many(120));

                render(<DiscogsCheckReport />);
                await screen.findByText('discogsCheck.newTitle');
                expect(screen.getAllByRole('checkbox')).toHaveLength(100);
                expect(screen.getByText(/discogsApply.moreHidden:\{"count":20\}/)).toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: 'discogsApply.showAll' }));

                const boxes = screen.getAllByRole('checkbox');
                expect(boxes).toHaveLength(120);
                boxes.forEach(box => expect(box).toBeChecked());
                expect(screen.queryByRole('button', { name: 'discogsApply.showAll' })).not.toBeInTheDocument();
            });

            it('applies the rows that are not shown too, because they are ticked', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(many(120));

                render(<DiscogsCheckReport />);
                fireEvent.click(await applyButton('discogsApply.applySelected'));
                fireEvent.click(screen.getByRole('button', { name: 'discogsApply.confirm' }));

                await waitFor(() => expect(applyDiscogsSelection).toHaveBeenCalledTimes(1));
                expect(vi.mocked(applyDiscogsSelection).mock.calls[0][0].add).toHaveLength(120);
            });

            it('applies up to 100 ticked records straight away', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(many(100));

                render(<DiscogsCheckReport />);
                fireEvent.click(await applyButton('discogsApply.applySelected'));

                await waitFor(() => expect(applyDiscogsSelection).toHaveBeenCalledTimes(1));
            });

            it('warns, with a time in minutes, before adding more than 100 ticked records', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(many(101));

                render(<DiscogsCheckReport />);
                fireEvent.click(await applyButton('discogsApply.applySelected'));

                expect(applyDiscogsSelection).not.toHaveBeenCalled();
                expect(screen.getByText(/longWarning:.*"count":101.*durationMinutes.*minutes.*:8/)).toBeInTheDocument();
                fireEvent.click(screen.getByRole('button', { name: 'discogsApply.confirm' }));
                await waitFor(() => expect(applyDiscogsSelection).toHaveBeenCalledTimes(1));
                expect(vi.mocked(applyDiscogsSelection).mock.calls[0][0].add).toHaveLength(101);
            });

            it('shows hours and minutes for a long job, also when applying everything', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(many(1000));

                render(<DiscogsCheckReport />);
                fireEvent.click(await applyButton('discogsApply.applyAll'));

                expect(screen.getByText(/longWarning:.*"count":1000.*durationHoursMinutes.*hours.*:1,.*minutes.*:23/)).toBeInTheDocument();
            });

            it('shows whole hours without minutes', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(many(720));

                render(<DiscogsCheckReport />);
                fireEvent.click(await applyButton('discogsApply.applyAll'));

                expect(screen.getByText(/durationHours:\{\\?"hours\\?":1\}/)).toBeInTheDocument();
            });

            it('does not warn when applying everything is small', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(drift());

                render(<DiscogsCheckReport />);
                fireEvent.click(await applyButton('discogsApply.applyAll'));

                expect(screen.queryByText(/longWarning/)).not.toBeInTheDocument();
            });

            it('cancelling the warning applies nothing', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(many(300));

                render(<DiscogsCheckReport />);
                fireEvent.click(await applyButton('discogsApply.applySelected'));
                fireEvent.click(screen.getAllByRole('button', { name: 'discogsApply.cancel' })[0]);

                expect(applyDiscogsSelection).not.toHaveBeenCalled();
            });
        });

        it('applies nothing when the confirmation is cancelled', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());

            render(<DiscogsCheckReport />);
            fireEvent.click(await applyButton('discogsApply.applyAll'));
            fireEvent.click(screen.getAllByRole('button', { name: 'discogsApply.cancel' })[0]);

            expect(applyDiscogsSelection).not.toHaveBeenCalled();
            expect(screen.queryByText(/confirmAllBody/)).not.toBeInTheDocument();
        });

        it('uses the Discogs dates only after a confirmation that shows how many items change', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());

            render(<DiscogsCheckReport />);
            fireEvent.click(await screen.findByRole('button', { name: 'discogsApply.useDates' }));

            expect(applyDiscogsSelection).not.toHaveBeenCalled();
            expect(screen.getByText('discogsApply.confirmDatesBody:{"count":5}')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'discogsApply.confirm' }));

            await waitFor(() => expect(applyDiscogsSelection).toHaveBeenCalledWith({ add: [], relink: [], useDiscogsDates: true }));
        });

        it('offers no dates action when no date differs', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift({
                counts: { discogs: 150, matched: 144, newOnDiscogs: 2, merged: 2, onlyInMusivault: 1, dateDiffers: 0 }
            }));

            render(<DiscogsCheckReport />);
            await screen.findByText('discogsCheck.newTitle');

            expect(screen.queryByRole('button', { name: 'discogsApply.useDates' })).not.toBeInTheDocument();
        });

        it('shows progress while it runs and keeps every button off', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift({ apply: apply() }));

            render(<DiscogsCheckReport />);

            expect(await screen.findByText('discogsApply.progress:{"done":1,"total":4}')).toBeInTheDocument();
            // A highlighted box, so a running apply can't be missed.
            expect(screen.getByRole('status')).toHaveClass('alert-info');
            expect(screen.getByRole('button', { name: 'discogsCheck.checkNow' })).toBeDisabled();
            expect(await applyButton('discogsApply.applyAll')).toBeDisabled();
            expect(screen.getByRole('button', { name: 'discogsApply.useDates' })).toBeDisabled();
        });

        describe('stopping', () => {
            it('offers Stop while it runs, and asks the server to stop', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(drift({ apply: apply() }));
                vi.mocked(stopDiscogsApply).mockResolvedValue(undefined);

                render(<DiscogsCheckReport />);
                fireEvent.click(await screen.findByRole('button', { name: 'discogsApply.stop' }));

                await waitFor(() => expect(stopDiscogsApply).toHaveBeenCalledTimes(1));
                // The status is re-read, so "stopping" shows as soon as the server has the request.
                await waitFor(() => expect(getDiscogsReport).toHaveBeenCalledTimes(2));
            });

            it('says it is stopping, and cannot be asked twice', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(drift({ apply: apply({ stopRequested: true }) }));

                render(<DiscogsCheckReport />);

                expect(await screen.findByText('discogsApply.stopping')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'discogsApply.stop' })).toBeDisabled();
            });

            it('tells the user when the stop could not be sent', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(drift({ apply: apply() }));
                vi.mocked(stopDiscogsApply).mockRejectedValue(new Error('boom'));

                render(<DiscogsCheckReport />);
                fireEvent.click(await screen.findByRole('button', { name: 'discogsApply.stop' }));

                await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('discogsApply.stopFailed'));
            });

            it('reports a stopped apply as stopped, with how far it got', async () => {
                vi.mocked(getDiscogsReport).mockResolvedValue(drift({
                    apply: apply({ status: 'completed', stopped: true, done: 120, total: 1467, added: 118, relinked: 2 })
                }));

                render(<DiscogsCheckReport />);

                expect(await screen.findByText('discogsApply.stoppedDone:{"done":120,"total":1467,"added":118,"relinked":2}')).toBeInTheDocument();
                expect(screen.queryByText(/discogsApply.done/)).not.toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'discogsApply.stop' })).not.toBeInTheDocument();
            });
        });

        it('keeps polling until the apply is done, then refreshes the collection once', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            vi.mocked(getDiscogsReport)
                .mockResolvedValueOnce(drift({ apply: apply() }))
                .mockResolvedValue(drift({ apply: apply({ status: 'completed', done: 4, total: 4, added: 2, relinked: 2 }) }));

            render(<DiscogsCheckReport />);
            await screen.findByText('discogsApply.progress:{"done":1,"total":4}');
            expect(refreshCollection).not.toHaveBeenCalled();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2100);
            });

            expect(await screen.findByText('discogsApply.done:{"added":2,"relinked":2}')).toBeInTheDocument();
            expect(refreshCollection).toHaveBeenCalledTimes(1);
            expect(refreshCollection).toHaveBeenCalledWith({ silent: true });
            // The navbar badge counts what is left, so it is re-read when the apply is done.
            expect(refreshPending).toHaveBeenCalledTimes(1);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(10000);
            });
            expect(getDiscogsReport).toHaveBeenCalledTimes(2);
            expect(refreshCollection).toHaveBeenCalledTimes(1);
        });

        it('does not refresh the collection for an apply that was already finished', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift({ apply: apply({ status: 'completed', done: 4 }) }));

            render(<DiscogsCheckReport />);
            await screen.findByText(/discogsApply.done/);

            expect(refreshCollection).not.toHaveBeenCalled();
        });

        it('reports what the apply did, including the rows that failed', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift({
                apply: apply({
                    status: 'completed', done: 4, added: 1, relinked: 1, skipped: 1, failed: 1, datesUpdated: 5, instanceIdsStored: 9,
                    failures: [{ kind: 'add', artist: 'Slayer', title: 'Reign In Blood', releaseId: 2, reason: 'No Discogs match found' }]
                })
            }));

            render(<DiscogsCheckReport />);

            expect(await screen.findByText('discogsApply.datesDone:{"count":5}')).toBeInTheDocument();
            expect(screen.getByText('discogsApply.linked:{"count":9}')).toBeInTheDocument();
            expect(screen.getByText('discogsApply.skipped:{"count":1}')).toBeInTheDocument();
            expect(screen.getByText('discogsApply.failedCount:{"count":1}')).toBeInTheDocument();
            expect(screen.getByText(/No Discogs match found/)).toBeInTheDocument();
        });

        it('asks to reconnect when Discogs rejected the token during the apply', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift({ apply: apply({ status: 'error', errorCode: 'needsReconnect' }) }));

            render(<DiscogsCheckReport />);

            expect(await screen.findByRole('alert')).toHaveTextContent('discogsAccount.needsReconnect');
        });

        it('tells the user when another Discogs job is running', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());
            vi.mocked(applyDiscogsSelection).mockRejectedValue(Object.assign(new Error('conflict'), {
                isAxiosError: true,
                response: { status: 409 }
            }));

            render(<DiscogsCheckReport />);
            fireEvent.click(await applyButton('discogsApply.applySelected'));

            await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('discogsApply.busy'));
        });

        it('tells the user when the apply could not be started', async () => {
            vi.mocked(getDiscogsReport).mockResolvedValue(drift());
            vi.mocked(applyDiscogsSelection).mockRejectedValue(new Error('boom'));

            render(<DiscogsCheckReport />);
            fireEvent.click(await applyButton('discogsApply.applySelected'));

            await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('discogsApply.startFailed'));
        });
    });
});
