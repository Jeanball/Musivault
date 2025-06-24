import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useCookies } from "react-cookie"; // Importer le hook
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import SearchBar from "../components/SearchBar";


interface VerificationResponse {
    status: boolean;
    user: string;
}

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const [cookies, removeCookie] = useCookies(["jwt"]); 
    const [username, setUsername] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const verifyUserFromCookie = async () => {
            if (!cookies.jwt) {
                navigate("/login");
                return;
            }

            try {
                const { data } = await axios.post<VerificationResponse>(
                    "http://localhost:5001/api/auth/verify",
                    {},
                    { withCredentials: true } 
                );

                const { status, user } = data;
                if (status) {
                    setUsername(user);
                    toast.success(`Bienvenue, ${user} !`, { position: "top-right" });
                } else {
                    removeCookie("jwt", { path: '/' });
                    navigate("/login");
                }

            } catch (error) {
                console.error("Verification failed", error);
                removeCookie("jwt", { path: '/' });
                navigate("/login");
            } finally {
                setIsLoading(false);
            }
        };

        verifyUserFromCookie();
    }, [cookies, navigate, removeCookie]);

    const handleLogout = async () => {
        try {
            await axios.post(
                "http://localhost:5001/api/auth/logout",
                {},
                { withCredentials: true }
            );
            navigate("/login");
        } catch (error) {
            console.error("Logout failed", error);
            toast.error("La déconnexion a échoué. Veuillez réessayer.");
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-base-200">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8" data-theme="dark">
            <div className="navbar bg-base-100 rounded-box shadow-xl mb-8">
                <div className="flex-1">
                    <span className="btn btn-ghost text-xl">Bonjour, {username}</span>
                </div>
                <div className="flex-none">
                    <button onClick={handleLogout} className="btn btn-outline btn-error">
                        Se déconnecter
                    </button>
                </div>
            </div>

            <div className="text-center">
                <h1 className="text-4xl font-bold">Votre Collection Musicale</h1>
                <p className="py-6">
                    Utilisez la barre de recherche ci-dessous pour trouver et ajouter de nouveaux albums.
                </p>
                <SearchBar />
            </div>
            <ToastContainer />
        </div>
    );
};

export default HomePage;
