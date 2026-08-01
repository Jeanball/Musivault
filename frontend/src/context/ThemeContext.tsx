import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getPreferences } from '../api/preferences';
import type { Preferences } from '../types/preferences.types';

type Theme = string;

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
    const [theme, setTheme] = useState<Theme>(
        localStorage.getItem('theme') || 'dark'
    );
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
     */
    const syncPreferencesFromServer = useCallback(async (): Promise<Preferences | null> => {
        try {
            const data = await getPreferences(true);
            if (data.theme && data.theme !== theme) {
                setTheme(data.theme);
            }
            if (data.wideScreenMode !== undefined && data.wideScreenMode !== wideScreenMode) {
                setWideScreenMode(data.wideScreenMode);
            }
            if (data.preferredCurrency && data.preferredCurrency !== preferredCurrency) {
                setPreferredCurrency(data.preferredCurrency);
            }
            return data;
        } catch {
            // Silent if not logged in or error - keep local preferences
            return null;
        }
    }, [theme, wideScreenMode, preferredCurrency]);



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
