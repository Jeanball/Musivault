import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import axios from 'axios';
import { useCookies } from 'react-cookie';
import Navbar from '../Navbar';

interface VerificationResponse {
    status: boolean;
    user: string;
}

const Layout: React.FC = () => {
    const navigate = useNavigate();
    const [cookies, , removeCookie] = useCookies(["jwt"]);
    const [username, setUsername] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const verifyUser = async () => {
            try {
                const { data } = await axios.post<VerificationResponse>(
                    "/api/auth/verify", {}, { withCredentials: true }
                );
                if (data.status) {
                    setUsername(data.user);
                } else {
                    removeCookie("jwt", { path: '/' });
                    navigate("/login");
                }
            } catch (error) {
                console.log(error)
                removeCookie("jwt", { path: '/' });
                navigate("/login");
            } finally {
                setIsLoading(false);
            }
        };
        verifyUser();
    }, [cookies, navigate, removeCookie]);

    const handleLogout = async () => {
        try {
            await axios.post("/api/auth/logout", {}, { withCredentials: true });
            removeCookie("jwt", { path: '/' });
            navigate("/login");
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
        <div className="p-4 md:p-8">
            <Navbar username={username} onLogout={handleLogout} />
            <main>
                <Outlet />
            </main>

        </div>
    );
};

export default Layout;
