import { Route, Routes } from 'react-router'
import HomePage from './pages/HomePage'
import CollectionPage from './pages/CollectionPage'

const App = () => {
  return (
    <div data-theme="dark">
      <Routes>
        <Route path='/' element={<HomePage/>}/>
        <Route path='/collection' element={<CollectionPage />}></Route>
      </Routes>
    </div>
  )
}

export default App