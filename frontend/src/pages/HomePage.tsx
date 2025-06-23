import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useCookies } from "react-cookie"; // Importer le hook
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import SearchBar from "../components/SearchBar";

// Interface pour la réponse attendue de votre API de vérification
interface VerificationResponse {
    status: boolean;
    user: string; // Le nom d'utilisateur
}

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    // Utiliser le hook useCookies. Le nom du cookie est 'jwt'.
    const [cookies, removeCookie] = useCookies(["token"]); 
    const [username, setUsername] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const verifyUserFromCookie = async () => {
            // Si le cookie 'jwt' n'existe pas, on redirige immédiatement
            if (!cookies.token) {
                navigate("/login");
                return; // Important de sortir de la fonction ici
            }

            try {
                // On appelle la route de vérification (vous devez créer cette route POST sur votre backend)
                // Elle doit pointer vers votre fonction userVerification
                const { data } = await axios.post<VerificationResponse>(
                    "http://localhost:5001/api/auth/", // Assurez-vous que cette route existe
                    {}, // Le corps de la requête est vide
                    { withCredentials: true } // Ceci est crucial pour envoyer les cookies
                );

                const { status, user } = data;
                if (status) {
                    setUsername(user);
                    toast.success(`Bienvenue, ${user} !`, { position: "top-right" });
                } else {
                    // Si le statut est false, le token est invalide. On le supprime et on redirige.
                    removeCookie("token", { path: '/' });
                    navigate("/login");
                }

            } catch (error) {
                console.error("Verification failed", error);
                removeCookie("token", { path: '/' });
                navigate("/login");
            } finally {
                setIsLoading(false);
            }
        };

        verifyUserFromCookie();
    }, [cookies, navigate, removeCookie]); // Le hook se redéclenche si les cookies changent

    const handleLogout = async () => {
        try {
            // La déconnexion doit se faire côté serveur pour supprimer le cookie httpOnly
            await axios.post(
                "http://localhost:5001/api/auth/logout",
                {},
                { withCredentials: true }
            );
            // On redirige vers la page de connexion
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
