import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import axios from 'axios';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { useTheme } from '../../context/ThemeContext';
import { toastService, toastMessages } from '../../utils/toast';
import { CollectionProvider } from '../../context/CollectionContext';

interface VerificationResponse {
    status: boolean;
    user: string;
    isAdmin: boolean;
}

export interface PrivateOutletContext {
    username: string;
    isAdmin: boolean;
}

interface LocationState {
    showLoginSuccess?: boolean;
}

const PrivateLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { syncPreferencesFromServer, wideScreenMode } = useTheme();
    const [username, setUsername] = useState<string>("");
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const hasShownLoginToast = useRef(false);

    useEffect(() => {
        const verifyUser = async () => {
            try {
                const { data } = await axios.post<VerificationResponse>(
                    "/api/auth/verify", {}, { withCredentials: true }
                );
                if (data.status) {
                    setUsername(data.user);
                    setIsAdmin(data.isAdmin);
                    // Sync preferences from server once user is verified
                    await syncPreferencesFromServer();

                    // Show login success toast AFTER theme sync (only once)
                    const state = location.state as LocationState;
                    if (state?.showLoginSuccess && !hasShownLoginToast.current) {
                        hasShownLoginToast.current = true;
                        toastService.success(toastMessages.auth.loginSuccess);
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
        verifyUser();
    }, [navigate, syncPreferencesFromServer, location.state]);

    const handleLogout = async () => {
        try {
            await axios.post("/api/auth/logout", {}, { withCredentials: true });
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
                        <Outlet context={{ username, isAdmin } satisfies PrivateOutletContext} />
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
