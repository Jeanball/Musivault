import { Route, Routes } from 'react-router'
import { CookiesProvider } from 'react-cookie';
import CollectionPage from './pages/CollectionPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import VersionsPage from './pages/VersionsPage';
import ArtistAlbumsPage from './pages/ArtistAlbumsPage';
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
              <Route path='/login' element={<LoginPage/>}/>
              <Route path='/signup' element={<SignupPage/>}/>

            {/* Protected Routes */}
            <Route path="/app" element={<PrivateLayout />}>
              <Route index element={<HomePage />} /> {/* La page d'accueil de l'app est maintenant à /app */}
              <Route path="collection" element={<CollectionPage />} />
              <Route path="artist/:artistId" element={<ArtistAlbumsPage />} />
              <Route path="master/:masterId" element={<VersionsPage />} />
              <Route path="release/:releaseId" element={<VersionsPage />} />
            </Route>
          </Routes>
        </div>
      </CookiesProvider>
    </ThemeProvider> 
  )
}

export default App