import { Route, Routes } from 'react-router'
import { CookiesProvider } from 'react-cookie'; 
import CollectionPage from './pages/CollectionPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import VersionsPage from './pages/VersionsPage';
import SearchPage from './pages/SearchPage'
import HomePage from './pages/HomePage';
import { ThemeProvider } from './context/ThemeContext';
import PublicLayout from './components/Layout/PublicLayout';
import PrivateLayout from './components/Layout/PrivateLayout';


const App = () => {
  return (
    <ThemeProvider>
      <CookiesProvider>
        <div >
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path='/login' element={<LoginPage/>}/>
              <Route path='/signup' element={<SignupPage/>}/>
              <Route path='/home' element={<HomePage/>}/>
            </Route>

            {/* Protected Routes */}
            <Route element={<PrivateLayout />}>
              <Route path='/' element={<SearchPage/>}/>
              <Route path='/collection' element={<CollectionPage />}></Route>
              <Route path="/master/:masterId" element={<VersionsPage />} />
            </Route>
          </Routes>
        </div>
      </CookiesProvider>
    </ThemeProvider> 
  )
}

export default App