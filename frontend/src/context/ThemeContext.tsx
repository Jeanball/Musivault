import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import axios from 'axios';

type Theme = string;

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    syncThemeFromServer: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setTheme] = useState<Theme>(
        localStorage.getItem('theme') || 'light'
    );

    // Apply theme to DOM and localStorage
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Function to sync theme from server (called after login)
    const syncThemeFromServer = async () => {
        try {
            const { data } = await axios.get('/api/users/preferences', { withCredentials: true });
            if (data.theme && data.theme !== theme) {
                setTheme(data.theme);
            }
        } catch {
            // Silent if not logged in or error - keep local theme
        }
    };



    return (
        <ThemeContext.Provider value={{ theme, setTheme, syncThemeFromServer }}>
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
