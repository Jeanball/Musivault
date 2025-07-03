import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const LandingPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Ce `useEffect` s'exécute une seule fois au chargement de la page.
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // On tente de vérifier si un cookie de session valide existe.
        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/verify`,
          {},
          { withCredentials: true }
        );

        // Si le statut est true, l'utilisateur est connecté.
        if (data.status) {
          navigate('/app'); // On le redirige immédiatement vers l'application.
        } else {
          // Sinon, l'utilisateur n'est pas connecté, on peut afficher la page.
          setIsLoading(false);
        }
      } catch (error) {
        console.log(error)
        // Une erreur signifie aussi que l'utilisateur n'est pas connecté.
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, [navigate]);

  // Pendant la vérification, on affiche un écran de chargement pour éviter un flash de contenu.
  if (isLoading) {
    return (
      <div className="hero min-h-screen bg-base-200">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, on affiche la page de présentation.
  return (
    <div className="hero min-h-screen" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=2070&auto=format&fit=crop)' }}>
      <div className="hero-overlay bg-opacity-60"></div>
      <div className="hero-content text-center text-neutral-content">
        <div className="max-w-md">
          <h1 className="mb-5 text-5xl font-bold">Votre Collection Musicale</h1>
          <p className="mb-5">
            Organisez, découvrez et gérez votre collection de vinyles et de CD. Retrouvez facilement toutes les éditions de vos albums préférés.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/login" className="btn btn-primary">Se connecter</Link>
            <Link to="/signup" className="btn btn-outline btn-secondary">Créer un compte</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
