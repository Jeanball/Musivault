import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Navbar from '../Navigation/Navbar';
import Footer from '../Navigation/Footer';
import PublicCollectionPage from '../../pages/PublicCollectionPage';
import { useTheme } from '../../context/ThemeContext';

interface AuthState {
    isAuthenticated: boolean;
    username: string;
    isAdmin: boolean;
}

const SharedCollectionLayout: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { wideScreenMode } = useTheme();
    const [authState, setAuthState] = useState<AuthState>({
        isAuthenticated: false,
        username: '',
        isAdmin: false,
    });
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data } = await axios.post(
                    '/api/auth/verify',
                    {},
                    { withCredentials: true }
                );
                if (data.status) {
                    setAuthState({
                        isAuthenticated: true,
                        username: data.user,
                        isAdmin: data.isAdmin,
                    });
                }
            } catch {
                // Not authenticated — that's fine
            } finally {
                setIsCheckingAuth(false);
            }
        };

        checkAuth();
    }, []);

    const handleLogout = async () => {
        try {
            await axios.post('/api/auth/logout', {}, { withCredentials: true });
            setAuthState({ isAuthenticated: false, username: '', isAdmin: false });
            navigate('/');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    if (isCheckingAuth) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    // Authenticated user: same experience as the app
    if (authState.isAuthenticated) {
        return (
            <div className="flex flex-col min-h-screen">
                <div className={`flex-1 p-4 md:p-8 ${wideScreenMode ? 'max-w-[1000px] mx-auto w-full' : ''}`}>
                    <Navbar
                        username={authState.username}
                        isAdmin={authState.isAdmin}
                        onLogout={handleLogout}
                    />
                    <main>
                        <PublicCollectionPage isAuthenticated />
                    </main>
                </div>
                <div className="mb-16 lg:mb-0">
                    <Footer />
                </div>
            </div>
        );
    }

    // Anonymous user: generic Musivault branding
    return (
        <div data-theme="dark" className="flex flex-col min-h-screen bg-base-100 text-base-content">
            {/* Generic Header */}
            <header className="navbar bg-base-100 shadow-lg px-4 md:px-8">
                <div className="navbar-start">
                    <Link to="/" className="btn btn-ghost normal-case gap-3 hover:bg-transparent">
                        <div className="avatar">
                            <div className="w-10 rounded-xl shadow-md ring ring-primary ring-offset-base-100 ring-offset-1">
                                <img src="/icons/icon-192x192.png" alt="Musivault Logo" />
                            </div>
                        </div>
                        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">MUSIVAULT</span>
                    </Link>
                </div>
                <div className="navbar-end">
                    <Link to="/login" className="btn btn-primary btn-sm">
                        {t('nav.signIn', 'Sign in')}
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 p-4 md:p-8 max-w-[1000px] mx-auto w-full">
                <PublicCollectionPage isAuthenticated={false} />
            </main>

            {/* Footer */}
            <Footer />
        </div>
    );
};

export default SharedCollectionLayout;
