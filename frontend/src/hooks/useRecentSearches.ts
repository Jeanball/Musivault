import { useCallback, useState } from 'react';

const STORAGE_KEY = 'musivault.recentSearches';
const MAX_RECENTS = 6;

function read(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [];
    } catch {
        // Private browsing, quota, or hand-edited storage: an empty list is fine
        return [];
    }
}

/**
 * The last few queries, so the empty search screen offers something to click
 * instead of an empty page. Served from the in-memory results cache on re-click,
 * which makes them feel instant.
 */
export function useRecentSearches() {
    const [recents, setRecents] = useState<string[]>(read);

    const remember = useCallback((query: string) => {
        const value = query.trim();
        if (!value) return;

        setRecents(prev => {
            const next = [value, ...prev.filter(q => q.toLowerCase() !== value.toLowerCase())]
                .slice(0, MAX_RECENTS);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Not being able to persist shouldn't break the search
            }
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setRecents([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Nothing to do, the in-memory list is already cleared
        }
    }, []);

    return { recents, remember, clear };
}
