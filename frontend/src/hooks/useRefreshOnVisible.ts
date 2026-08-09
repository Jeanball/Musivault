import { useEffect, useRef } from 'react';

const THROTTLE_MS = 60 * 1000;

/**
 * Re-run `refresh` when the user comes back to the tab.
 *
 * A page left open goes stale silently: the price sync task, or the same user in
 * a second tab, can move the data underneath it. Throttled because tab flicking
 * would otherwise fire a burst of requests for nothing.
 */
export const useRefreshOnVisible = (refresh: () => void) => {
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;

    const lastRunRef = useRef<number>(Date.now());

    useEffect(() => {
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
