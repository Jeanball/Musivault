import { Outlet, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import axios from 'axios';

const PublicLayout = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data } = await axios.post(
                    "/api/auth/verify",
                    {},
                    { withCredentials: true }
                );

                if (data.status) {
                    navigate("/app");
                }
            } catch (error) {
                // If verification fails, user is not logged in, which is fine for public layout
                // We don't need to do anything, just let them see the public page
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-base-100">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div data-theme="dark" className="bg-base-100 min-h-screen text-base-content">
            <Outlet />
        </div>
    );
};

export default PublicLayout;
