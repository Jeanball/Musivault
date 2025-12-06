import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import Hero from '../components/Hero';
import Footer from '../components/Footer';
import Features from '../components/Features';

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
    <div>
      <Hero />
      <Features />
      <Footer />
    </div>
  );
};

export default LandingPage;
