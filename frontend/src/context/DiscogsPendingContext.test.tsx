import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DiscogsPendingProvider, useDiscogsPending } from './DiscogsPendingContext';
import { getDiscogsSummary } from '../api/discogsSync';

vi.mock('../api/discogsSync', () => ({ getDiscogsSummary: vi.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => <DiscogsPendingProvider>{children}</DiscogsPendingProvider>;
const summary = (newOnDiscogs: number, merged = 0) => ({ finishedAt: '2026-10-11T08:00:00Z', newOnDiscogs, merged });
const KEY = 'musivault.discogsNoticeDismissed';

/** An in-memory localStorage: the one in the test runtime is not reliably there. */
const memoryStorage = () => {
    const data = new Map<string, string>();
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
        clear: () => data.clear()
    };
};

const mount = async (first: ReturnType<typeof summary> | null) => {
    vi.mocked(getDiscogsSummary).mockResolvedValue(first);
    const view = renderHook(() => useDiscogsPending(), { wrapper });
    await waitFor(() => expect(getDiscogsSummary).toHaveBeenCalled());
    return view;
};
const reload = async (view: Awaited<ReturnType<typeof mount>>, next: ReturnType<typeof summary> | null) => {
    vi.mocked(getDiscogsSummary).mockResolvedValue(next);
    await act(async () => { await view.result.current.refresh(); });
};

describe('DiscogsPendingContext', () => {
    afterEach(() => vi.unstubAllGlobals());

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('localStorage', memoryStorage());
    });

    it('counts new and merged records, and shows the notice', async () => {
        const { result } = await mount(summary(3, 2));

        await waitFor(() => expect(result.current.count).toBe(5));
        expect(result.current).toMatchObject({ newOnDiscogs: 3, merged: 2, showNotice: true });
    });

    it('shows nothing when there is nothing to act on, or no check', async () => {
        const { result } = await mount(null);

        expect(result.current).toMatchObject({ count: 0, showNotice: false });
    });

    it('hides the notice when dismissed, but keeps the count for the badge', async () => {
        const { result } = await mount(summary(3));
        await waitFor(() => expect(result.current.showNotice).toBe(true));

        act(() => result.current.dismissNotice());

        expect(result.current.showNotice).toBe(false);
        expect(result.current.count).toBe(3);
        expect(localStorage.getItem(KEY)).toBe('3');
    });

    it('stays quiet when a later check finds the same, but comes back when it finds more', async () => {
        const view = await mount(summary(3));
        await waitFor(() => expect(view.result.current.showNotice).toBe(true));
        act(() => view.result.current.dismissNotice());

        await reload(view, summary(3));
        expect(view.result.current.showNotice).toBe(false);

        await reload(view, summary(5));
        expect(view.result.current.showNotice).toBe(true);
    });

    it('remembers a dismissal across reloads', async () => {
        localStorage.setItem(KEY, '3');

        const { result } = await mount(summary(3));

        await waitFor(() => expect(result.current.count).toBe(3));
        expect(result.current.showNotice).toBe(false);
    });

    it('notices new records after an apply cleared the old ones', async () => {
        const view = await mount(summary(3));
        await waitFor(() => expect(view.result.current.showNotice).toBe(true));
        act(() => view.result.current.dismissNotice());

        await reload(view, null);
        expect(localStorage.getItem(KEY)).toBe('0');
        await reload(view, summary(1));

        expect(view.result.current.showNotice).toBe(true);
    });

    it('keeps what it had when the summary cannot be read', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const view = await mount(summary(3));
        await waitFor(() => expect(view.result.current.count).toBe(3));

        vi.mocked(getDiscogsSummary).mockRejectedValue(new Error('offline'));
        await act(async () => { await view.result.current.refresh(); });

        expect(view.result.current.count).toBe(3);
    });

    it('works when storage is blocked', async () => {
        vi.stubGlobal('localStorage', {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('blocked'); }
        });
        const { result } = await mount(summary(2));
        await waitFor(() => expect(result.current.showNotice).toBe(true));

        act(() => result.current.dismissNotice());

        expect(result.current.showNotice).toBe(false);
    });

    it('does nothing without a provider', () => {
        const { result } = renderHook(() => useDiscogsPending());

        expect(result.current).toMatchObject({ count: 0, showNotice: false });
    });
});
