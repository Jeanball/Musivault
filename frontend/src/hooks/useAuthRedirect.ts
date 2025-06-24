import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';

export const useAuthRedirect = () => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuthStatus = async () => {
            try {
                const { data } = await axios.post(
                    "http://localhost:5001/api/auth/verify",
                    {},
                    { withCredentials: true }
                );
                if (data.status) {
                    navigate("/");
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Erreur lors de la vérification de l'authentification :", error);
                setIsLoading(false);
            }
        };

        checkAuthStatus();
    }, [navigate]);

    return { isLoading };
};