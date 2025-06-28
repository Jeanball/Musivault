import { Route, Routes } from 'react-router'
import { CookiesProvider } from 'react-cookie'; 

import Layout from './components/Layout/Layout';

import CollectionPage from './pages/CollectionPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import VersionsPage from './pages/VersionsPage';
import HomePage from './pages/HomePage'

const App = () => {
  return (
    <div data-theme="dark">
      <CookiesProvider>
      <Routes>
        
        <Route path='/login' element={<LoginPage/>}/>
        <Route path='/signup' element={<SignupPage/>}/>

        <Route element={<Layout />}>
          <Route path='/' element={<HomePage/>}/>
          <Route path='/collection' element={<CollectionPage />}></Route>
          <Route path="/master/:masterId" element={<VersionsPage />} />
        </Route>
        
      </Routes>
      </CookiesProvider>
    </div>
  )
}

export default App