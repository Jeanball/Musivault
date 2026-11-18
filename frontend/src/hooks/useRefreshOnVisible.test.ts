import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRefreshOnVisible } from './useRefreshOnVisible';

const setVisibility = (state: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
};

describe('useRefreshOnVisible', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('does not refresh when the tab comes back within a minute of mounting', () => {
        const refresh = vi.fn();
        renderHook(() => useRefreshOnVisible(refresh));

        vi.advanceTimersByTime(30_000);
        setVisibility('visible');

        expect(refresh).not.toHaveBeenCalled();
    });

    it('refreshes once per minute at most', () => {
        const refresh = vi.fn();
        renderHook(() => useRefreshOnVisible(refresh));

        vi.advanceTimersByTime(61_000);
        setVisibility('visible');
        setVisibility('visible');
        expect(refresh).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(61_000);
        setVisibility('visible');
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('ignores the tab being hidden', () => {
        const refresh = vi.fn();
        renderHook(() => useRefreshOnVisible(refresh));

        vi.advanceTimersByTime(61_000);
        setVisibility('hidden');

        expect(refresh).not.toHaveBeenCalled();
    });
});
