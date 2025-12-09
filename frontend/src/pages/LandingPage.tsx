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

  // This `useEffect` runs only once when the page loads.
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Try to verify if a valid session cookie exists.
        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/verify`,
          {},
          { withCredentials: true }
        );

        // If status is true, the user is logged in.
        if (data.status) {
          navigate('/app'); // Redirect to the app immediately.
        } else {
          // Otherwise, the user is not logged in, we can display the page.
          setIsLoading(false);
        }
      } catch (error) {
        console.log(error)
        // An error also means the user is not logged in.
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, [navigate]);

  // During verification, we display a loading screen to avoid a content flash.
  if (isLoading) {
    return (
      <div className="hero min-h-screen bg-base-200">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // If the user is not logged in, display the landing page.
  return (
    <div>
      <Hero />
      <Features />
      <Footer />
    </div>
  );
};

export default LandingPage;
