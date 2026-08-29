import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import KigoLoader from './KigoLoader'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <KigoLoader message="Cargando" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
