import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import RequireAuth from './components/RequireAuth'
import ConsoleShell from './components/ConsoleShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Visits from './pages/Visits'
import VisitDetail from './pages/VisitDetail'
import HostAuthorize from './pages/HostAuthorize'
import HostConsole from './pages/HostConsole'
import InviteForm from './pages/InviteForm'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Host authorization mini-app (embeds in the Kigo app via WebView).
              No console login required — identity/context come from Kigo. */}
          <Route path="/authorize/:id" element={<HostAuthorize />} />
          <Route path="/authorize" element={<HostAuthorize />} />
          {/* Read-only visitor view opened from the badge QR. */}
          <Route path="/visit/:id" element={<HostAuthorize readOnly />} />
          <Route path="/visit" element={<HostAuthorize readOnly />} />
          {/* Host console-lite: today's visits (pending/active/completed),
              approve, check-out and WhatsApp. Embedded in the Kigo app. */}
          <Route path="/host" element={<HostConsole />} />
          {/* Web invite form: pre-register a visit + downloadable QR. Opened
              standalone (shared link) or from the host console. */}
          <Route path="/invite" element={<InviteForm />} />
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
