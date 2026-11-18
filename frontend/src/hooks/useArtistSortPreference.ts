import { useState, useEffect } from 'react';
import { getPreferences } from '../api/preferences';

/**
 * Reads the "ignore a leading article when sorting artists" preference.
 * Falls back to false when there is no session, which is what keeps a shared
 * collection opened by a visitor on the plain alphabetical order.
 */
export const useArtistSortPreference = (): boolean => {
    const [ignoreLeadingArticle, setIgnoreLeadingArticle] = useState(false);

    useEffect(() => {
        let active = true;
        getPreferences()
            .then(prefs => {
                if (active) setIgnoreLeadingArticle(prefs.sortIgnoreLeadingArticle || false);
            })
            .catch(() => {
                // No session or request failed: keep the default order.
            });
        return () => {
            active = false;
        };
    }, []);

    return ignoreLeadingArticle;
};
