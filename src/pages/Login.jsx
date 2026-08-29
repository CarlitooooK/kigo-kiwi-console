import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { IconShield, IconMail, IconLock, IconEye, IconEyeOff, IconAlertCircle } from '../components/icons'

function mapAuthError(message) {
  if (message.includes('Invalid login credentials')) {
    return 'Credenciales incorrectas. Verifica tu correo y contraseña.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Correo no confirmado. Revisa tu bandeja de entrada.'
  }
  return 'Error de autenticación. Intenta de nuevo.'
}

export default function Login() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const kioskUrl = import.meta.env.VITE_KIOSK_URL
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  if (!authLoading && user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const errors = {}
    if (!email.trim()) errors.email = 'El correo es obligatorio'
    else if (!email.includes('@')) errors.email = 'Ingresa un correo válido'
    if (!password) errors.password = 'La contraseña es obligatoria'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError(mapAuthError(authError.message))
      setLoading(false)
      return
    }

    navigate('/')
  }

  return (
    <div className="login-shell">
      {/* Brand panel */}
      <div
        className="login-brand"
        style={{
          background: 'var(--orange-gradient-diag)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          color: 'var(--white)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            width: 420,
            height: 420,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            top: -140,
            right: -140,
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            bottom: -100,
            left: -80,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconShield size={19} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Kigo Welcome</span>
        </div>

        <div style={{ position: 'relative', maxWidth: 340 }}>
          <h2 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, margin: '0 0 12px' }}>
            Control de acceso e inteligencia de visitantes
          </h2>
          <p style={{ fontSize: 14, opacity: 0.88, lineHeight: 1.6, margin: 0 }}>
            Gestiona visitas, autorizaciones y el recorrido completo de cada visitante desde un
            solo lugar.
          </p>
        </div>

        <div style={{ position: 'relative', fontSize: 12, opacity: 0.7 }}>
          Consola de administración · Corporativo
        </div>
      </div>

      {/* Form panel */}
      <div className="login-form-panel">
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 380 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--slate-900)', margin: '0 0 6px' }}>
            Iniciar sesión
          </h1>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', margin: '0 0 32px' }}>
            Ingresa tus credenciales para acceder a la consola.
          </p>

          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <div className="input-wrap">
              <span className="input-icon">
                <IconMail size={17} />
              </span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="has-icon"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {fieldErrors.email && (
              <div className="field-error">
                <IconAlertCircle size={13} />
                {fieldErrors.email}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <div className="input-wrap">
              <span className="input-icon">
                <IconLock size={17} />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="has-icon has-icon-right"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Mostrar/ocultar contraseña"
              >
                {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
              </button>
            </div>
            {fieldErrors.password && (
              <div className="field-error">
                <IconAlertCircle size={13} />
                {fieldErrors.password}
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                background: 'var(--red-100)',
                borderRadius: 10,
                padding: '11px 14px',
                display: 'flex',
                gap: 9,
                alignItems: 'flex-start',
                marginBottom: 18,
              }}
            >
              <span style={{ color: 'var(--red-500)', flexShrink: 0, marginTop: 1 }}>
                <IconAlertCircle size={16} />
              </span>
              <span style={{ fontSize: 13, color: 'var(--red-500)', lineHeight: 1.4 }}>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? <span className="spinner spinner-sm" style={{ borderTopColor: 'var(--white)', borderColor: 'rgba(255,255,255,0.4)' }} /> : 'Iniciar sesión'}
          </button>

          {kioskUrl && (
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <a href={kioskUrl} className="btn-ghost" style={{ textDecoration: 'none', fontSize: 13 }}>
                Volver al kiosco
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
