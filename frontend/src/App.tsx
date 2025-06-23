import { Route, Routes } from 'react-router'
import HomePage from './pages/HomePage'
import { CookiesProvider } from 'react-cookie'; 
import CollectionPage from './pages/CollectionPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

const App = () => {
  return (
    <div data-theme="dark">
      <CookiesProvider>
      <Routes>
        <Route path='/' element={<HomePage/>}/>
        <Route path='/login' element={<LoginPage/>}/>
        <Route path='/signup' element={<SignupPage/>}/>
        <Route path='/collection' element={<CollectionPage />}></Route>
      </Routes>
      </CookiesProvider>
    </div>
  )
}

export default App