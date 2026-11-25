import { useEffect, useRef } from 'react';

const THROTTLE_MS = 60 * 1000;

/**
 * Refresh once on mount, then re-run `refresh` when the user comes back to the tab.
 *
 * A page left open goes stale silently: the price sync task, or the same user in
 * a second tab, can move the data underneath it. The provider may also have
 * loaded the collection long before this page was opened, so mounting is a
 * refresh point too. Throttled because tab flicking would otherwise fire a
 * burst of requests for nothing.
 */
export const useRefreshOnVisible = (refresh: () => void): void => {
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;

    const lastRunRef = useRef<number>(0);

    useEffect(() => {
        lastRunRef.current = Date.now();
        refreshRef.current();

        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - lastRunRef.current < THROTTLE_MS) return;

            lastRunRef.current = Date.now();
            refreshRef.current();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);
};
