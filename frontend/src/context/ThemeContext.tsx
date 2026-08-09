import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getPreferences } from '../api/preferences';
import type { Preferences } from '../types/preferences.types';
import { DEFAULT_THEME, isTheme, type Theme } from '../constants/themes';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    wideScreenMode: boolean;
    setWideScreenMode: (enabled: boolean) => void;
    preferredCurrency: string;
    setPreferredCurrency: (currency: string) => void;
    syncPreferencesFromServer: () => Promise<Preferences | null>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem('theme');
        return isTheme(stored) ? stored : DEFAULT_THEME;
    });
    const [wideScreenMode, setWideScreenMode] = useState<boolean>(
        localStorage.getItem('wideScreenMode') === 'true' // Default to false
    );
    const [preferredCurrency, setPreferredCurrency] = useState<string>(
        localStorage.getItem('preferredCurrency') || 'USD'
    );

    // Apply theme to DOM and localStorage
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Keep the mobile browser chrome on the theme's own background. Read
        // back from the DOM rather than from a table of colours, so themes
        // added to index.css are covered without touching this.
        const meta = document.querySelector('meta[name="theme-color"]');
        const background = getComputedStyle(document.documentElement).backgroundColor;
        if (meta && background) {
            meta.setAttribute('content', background);
        }
    }, [theme]);

    // Apply wideScreenMode to localStorage
    useEffect(() => {
        localStorage.setItem('wideScreenMode', String(wideScreenMode));
    }, [wideScreenMode]);

    // Apply preferredCurrency to localStorage
    useEffect(() => {
        localStorage.setItem('preferredCurrency', preferredCurrency);
    }, [preferredCurrency]);

    /**
     * Called after login, so it bypasses the cache in case it still holds the
     * previous user's values. Returns the preferences so callers don't need a
     * second request to read the fields this context doesn't track.
     *
     * Deliberately dependency-free: this function is read by effects in the
     * layouts, and a new identity on every preference change would re-run them.
     * No need to compare against current state first either — React drops a
     * re-render when a setter is handed the value it already holds.
     */
    const syncPreferencesFromServer = useCallback(async (): Promise<Preferences | null> => {
        try {
            const data = await getPreferences(true);
            if (isTheme(data.theme)) {
                setTheme(data.theme);
            }
            if (data.wideScreenMode !== undefined) {
                setWideScreenMode(data.wideScreenMode);
            }
            if (data.preferredCurrency) {
                setPreferredCurrency(data.preferredCurrency);
            }
            return data;
        } catch {
            // Silent if not logged in or error - keep local preferences
            return null;
        }
    }, []);



    return (
        <ThemeContext.Provider value={{ theme, setTheme, wideScreenMode, setWideScreenMode, preferredCurrency, setPreferredCurrency, syncPreferencesFromServer }}>
            {children}
        </ThemeContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
