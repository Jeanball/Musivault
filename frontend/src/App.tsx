import { Route, Routes } from 'react-router'
import { CookiesProvider } from 'react-cookie';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useState, useEffect } from 'react';
import CollectionPage from './pages/CollectionPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import VersionsPage from './pages/VersionsPage';
import ReleasePage from './pages/ReleasePage';
import ArtistAlbumsPage from './pages/ArtistAlbumsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import AlbumDetailPage from './pages/AlbumDetailPage';
import PublicCollectionPage from './pages/PublicCollectionPage';
import DiscoverPage from './pages/DiscoverPage';
import { ThemeProvider } from './context/ThemeContext';
import PrivateLayout from './components/Layout/PrivateLayout';


import PublicLayout from './components/Layout/PublicLayout';

const App = () => {
  // Responsive toast position: top on mobile, bottom-right on desktop
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ThemeProvider>
      <CookiesProvider>
        <div >
          <Routes>
            {/* Public Routes - Forced Dark Theme */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path='/login' element={<LoginPage />} />
              <Route path='/signup' element={<SignupPage />} />
            </Route>

            {/* Public Collection Route - No Auth Required */}
            <Route path="/collection/:shareId" element={<PublicCollectionPage />} />

            {/* Protected Routes - User Theme */}
            <Route path="/app" element={<PrivateLayout />}>
              <Route index element={<HomePage />} />
              <Route path="collection" element={<CollectionPage />} />
              <Route path="album/:itemId" element={<AlbumDetailPage />} />
              <Route path="master/:masterId" element={<VersionsPage />} />
              <Route path="release/:releaseId" element={<ReleasePage />} />
              <Route path="artist/:artistId" element={<ArtistAlbumsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="discover" element={<DiscoverPage />} />
            </Route>
          </Routes>
        </div>

        {/* Global Toast Container - Top on mobile, bottom-right on desktop */}
        <ToastContainer
          position={isMobile ? "top-center" : "bottom-right"}
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </CookiesProvider>
    </ThemeProvider>
  )
}

export default App