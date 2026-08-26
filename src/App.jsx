import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RequireAuth from './components/RequireAuth'
import ConsoleShell from './components/ConsoleShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Visits from './pages/Visits'
import VisitDetail from './pages/VisitDetail'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <ConsoleShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/visits" element={<Visits />} />
            <Route path="/visits/:id" element={<VisitDetail />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
