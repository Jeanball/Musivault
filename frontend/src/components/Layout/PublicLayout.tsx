import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import axios from 'axios';

const PublicLayout: React.FC = () => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuthStatus = async () => {
            try {
                const { data } = await axios.post(
                    "/api/auth/verify", {}, { withCredentials: true }
                );
                if (data.status) {
                    navigate("/");
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                console.log(error)
                setIsLoading(false);
            }
        };

        checkAuthStatus();
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }
    
    return <Outlet />;
};

export default PublicLayout;
