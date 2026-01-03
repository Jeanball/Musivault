import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';

type Theme = string;

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    wideScreenMode: boolean;
    setWideScreenMode: (enabled: boolean) => void;
    syncPreferencesFromServer: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setTheme] = useState<Theme>(
        localStorage.getItem('theme') || 'dark'
    );
    const [wideScreenMode, setWideScreenMode] = useState<boolean>(
        localStorage.getItem('wideScreenMode') === 'true' // Default to false
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

    // Function to sync preferences from server (called after login)
    const syncPreferencesFromServer = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/users/preferences', { withCredentials: true });
            if (data.theme && data.theme !== theme) {
                setTheme(data.theme);
            }
            if (data.wideScreenMode !== undefined && data.wideScreenMode !== wideScreenMode) {
                setWideScreenMode(data.wideScreenMode);
            }
        } catch {
            // Silent if not logged in or error - keep local preferences
        }
    }, [theme, wideScreenMode]);



    return (
        <ThemeContext.Provider value={{ theme, setTheme, wideScreenMode, setWideScreenMode, syncPreferencesFromServer }}>
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
