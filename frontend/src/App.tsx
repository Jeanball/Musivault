import { Route, Routes } from 'react-router'
import { CookiesProvider } from 'react-cookie';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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
import { ThemeProvider } from './context/ThemeContext';
import PrivateLayout from './components/Layout/PrivateLayout';



const App = () => {
  return (
    <ThemeProvider>
      <CookiesProvider>
        <div >
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path='/login' element={<LoginPage />} />
            <Route path='/signup' element={<SignupPage />} />

            {/* Protected Routes */}
            <Route path="/app" element={<PrivateLayout />}>
              <Route index element={<HomePage />} />
              <Route path="collection" element={<CollectionPage />} />
              <Route path="master/:masterId" element={<VersionsPage />} />
              <Route path="release/:releaseId" element={<ReleasePage />} />
              <Route path="artist/:artistId" element={<ArtistAlbumsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Routes>
        </div>

        {/* Global Toast Container */}
        <ToastContainer
          position="bottom-right"
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