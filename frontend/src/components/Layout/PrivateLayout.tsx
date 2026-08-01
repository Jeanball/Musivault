import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import Navbar from '../Navigation/Navbar';
import Footer from '../Navigation/Footer';
import { useTheme } from '../../context/ThemeContext';
import { toastService } from '../../utils/toast';
import { CollectionProvider } from '../../context/CollectionContext';
import type { PrivateOutletContext } from '../../types/auth.types';
import { verify, logout } from '../../api/auth';


interface LocationState {
    showLoginSuccess?: boolean;
}

const PrivateLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation();
    const { syncPreferencesFromServer, wideScreenMode } = useTheme();
    const [username, setUsername] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [displayName, setDisplayName] = useState<string>("");
    const [userId, setUserId] = useState<string>("");
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const hasShownLoginToast = useRef(false);

    const verifyUser = async () => {
        try {
            const data = await verify();
            if (data.status) {
                setUsername(data.user);
                setEmail(data.email);
                setDisplayName(data.displayName || '');
                setUserId(data.userId);
                setIsAdmin(data.isAdmin);
                // Sync preferences from server once user is verified. The
                // returned value also carries the language, which this layout
                // owns rather than the theme context.
                const preferences = await syncPreferencesFromServer();
                if (preferences?.language && preferences.language !== i18n.language) {
                    i18n.changeLanguage(preferences.language);
                }

                // Show login success toast AFTER theme sync (only once)
                const state = location.state as LocationState;
                if (state?.showLoginSuccess && !hasShownLoginToast.current) {
                    hasShownLoginToast.current = true;
                    toastService.success(t('auth.loginSuccess', 'Connection successful!'));
                    // Clear the state to prevent showing toast on refresh
                    window.history.replaceState({}, document.title);
                }

                setIsLoading(false);
            } else {
                navigate("/login");
            }
        } catch (error) {
            console.log(error)
            navigate("/login");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        verifyUser();
    }, [navigate, syncPreferencesFromServer, location.state]);

    const handleLogout = async () => {
        try {
            await logout();
            navigate("/");
        } catch (error) {
            console.error("Disconnection failed.", error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            <div className={`flex-1 p-4 md:p-8 ${wideScreenMode ? 'max-w-[1000px] mx-auto w-full' : ''}`}>
                <Navbar username={username} isAdmin={isAdmin} onLogout={handleLogout} />
                <main>
                    <CollectionProvider>
                        <Outlet context={{ username, email, displayName, userId, isAdmin, refreshUser: verifyUser } satisfies PrivateOutletContext} />
                    </CollectionProvider>
                </main>
            </div>
            <div className="mb-16 lg:mb-0">
                <Footer />
            </div>
        </div>
    );
};

export default PrivateLayout;
