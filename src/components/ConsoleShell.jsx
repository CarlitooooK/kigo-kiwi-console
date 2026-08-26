import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { avatarColor } from '../lib/status'
import { IconShield, IconGrid, IconUsers, IconLogout } from './icons'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconGrid, end: true },
  { to: '/visits', label: 'Visitas', icon: IconUsers },
]

export default function ConsoleShell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const email = user?.email ?? ''
  const initial = email ? email[0].toUpperCase() : '?'
  const avatar = avatarColor(email)

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <IconShield size={18} />
          </div>
          <div className="sidebar-brand-text">
            <strong>Kigo Welcome</strong>
            <span>Consola</span>
          </div>
        </div>

        <div className="sidebar-section-label">Menú</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <Icon size={18} />
                <span className="sidebar-link-label">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar" style={{ background: avatar.bg, color: avatar.fg }}>
              {initial}
            </div>
            <div className="user-chip-info">
              <strong>{email.split('@')[0] || 'Usuario'}</strong>
              <span>{email}</span>
            </div>
            <button className="icon-btn" title="Cerrar sesión" onClick={handleLogout}>
              <IconLogout size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
