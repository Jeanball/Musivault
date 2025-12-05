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

    // Appliquer le thème au DOM et localStorage
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Fonction pour synchroniser le thème depuis le serveur (appelée après login)
    const syncThemeFromServer = async () => {
        try {
            const { data } = await axios.get('/api/users/preferences', { withCredentials: true });
            if (data.theme && data.theme !== theme) {
                setTheme(data.theme);
            }
        } catch {
            // Silencieux si non connecté ou erreur - on garde le thème local
        }
    };

    // Charger le thème du serveur au montage (si l'utilisateur est connecté)
    useEffect(() => {
        syncThemeFromServer();
    }, []);

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
