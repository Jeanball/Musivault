import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getDiscogsSummary } from '../api/discogsSync';
import { useRefreshOnVisible } from '../hooks/useRefreshOnVisible';

const STORAGE_KEY = 'musivault.discogsNoticeDismissed';

interface DiscogsPendingContextType {
    /** Records new on Discogs and merged ones the last check left to act on. */
    newOnDiscogs: number;
    merged: number;
    /** `newOnDiscogs + merged`. Drives the badge, which stays until nothing is left. */
    count: number;
    /** The notice: shown while there is more to act on than when it was last dismissed. */
    showNotice: boolean;
    dismissNotice: () => void;
    /** Re-read the counts, e.g. after a check or an apply finished. */
    refresh: () => Promise<void>;
}

const noop = async () => undefined;
const DiscogsPendingContext = createContext<DiscogsPendingContextType>({
    newOnDiscogs: 0, merged: 0, count: 0, showNotice: false, dismissNotice: () => undefined, refresh: noop
});

// Per browser, not per account: a dismissed notice comes back on another device. Storage can be
// blocked (private windows), so every access is guarded and the notice just works without it.
const readDismissed = (): number => {
    try {
        return Number(localStorage.getItem(STORAGE_KEY)) || 0;
    } catch {
        return 0;
    }
};
const writeDismissed = (value: number) => {
    try {
        localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
        // Not remembered; the notice may show again.
    }
};

/**
 * What the last Discogs check left to act on, for the navbar badge and the notice in Settings.
 * The badge shows the live count. The notice is dismissed at a count and only returns when a later
 * check finds more than that, so the same leftovers don't nag; the stored count follows the real
 * one down, so new items after an apply are noticed again.
 */
export const DiscogsPendingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [counts, setCounts] = useState({ newOnDiscogs: 0, merged: 0 });
    const [dismissed, setDismissed] = useState(readDismissed);

    const refresh = useCallback(async () => {
        try {
            const summary = await getDiscogsSummary();
            const next = { newOnDiscogs: summary?.newOnDiscogs ?? 0, merged: summary?.merged ?? 0 };
            setCounts(next);
            const total = next.newOnDiscogs + next.merged;
            setDismissed(current => {
                if (total >= current) return current;
                writeDismissed(total);
                return total;
            });
        } catch (error) {
            // A badge is not worth an error: keep what we had.
            console.error('Failed to fetch the Discogs summary:', error);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);
    useRefreshOnVisible(() => void refresh());

    const count = counts.newOnDiscogs + counts.merged;
    const dismissNotice = useCallback(() => {
        writeDismissed(count);
        setDismissed(count);
    }, [count]);

    const value = useMemo(
        () => ({ ...counts, count, showNotice: count > dismissed, dismissNotice, refresh }),
        [counts, count, dismissed, dismissNotice, refresh]
    );

    return <DiscogsPendingContext.Provider value={value}>{children}</DiscogsPendingContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDiscogsPending = () => useContext(DiscogsPendingContext);
