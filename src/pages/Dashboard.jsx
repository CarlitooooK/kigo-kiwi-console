import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardMetrics, getRecentVisitsWithJourney, formatMinutes } from '../lib/dashboardStats'
import { trustColor, trustLabel } from '../lib/trust'
import { avatarColor } from '../lib/status'
import PageHeader from '../components/PageHeader'
import KigoError from '../components/KigoError'
import KigoEmpty from '../components/KigoEmpty'
import StatusBadge from '../components/StatusBadge'
import TrustRing from '../components/TrustRing'
import BarChart from '../components/BarChart'
import DonutChart from '../components/DonutChart'
import JourneyTimeline from '../components/JourneyTimeline'
import {
  IconCalendar,
  IconPin,
  IconClock,
  IconCheckCircle,
  IconUsers,
  IconChevronRight,
  IconInbox,
} from '../components/icons'

const EMPTY_METRICS = {
  totalToday: 0,
  active: 0,
  pending: 0,
  completed: 0,
  avgTrustScore: null,
  trustEvaluatedCount: 0,
  trustBuckets: { excellent: 0, acceptable: 0, low: 0 },
  avgVisitDurationMinutes: null,
  avgWaitMinutes: null,
  visitsByDay: [],
}

function StatCard({ title, value, icon: Icon, bg, fg, loading }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg, color: fg }}>
        <Icon size={19} />
      </div>
      {loading ? <div className="skeleton" style={{ width: 48, height: 30 }} /> : <div className="stat-value">{value}</div>}
      <div className="stat-label">{title}</div>
    </div>
  )
}

function MetricCard({ title, children, loading }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)' }}>{title}</span>
      {loading ? <div className="skeleton" style={{ width: '60%', height: 26 }} /> : children}
    </div>
  )
}

function QuickAction({ icon: Icon, label, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'box-shadow 0.15s var(--ease)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-xs)')}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'var(--umbral-100)',
          color: 'var(--kigo-600)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--slate-900)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{description}</div>
      </div>
      <IconChevronRight size={16} style={{ color: 'var(--gray-400)' }} />
    </button>
  )
}

function RecentVisitCard({ visit, events }) {
  const visitor = visit.visitors ?? {}
  const firstName = visitor.first_name ?? ''
  const avatar = avatarColor(firstName)
  const time = new Date(visit.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div className="avatar" style={{ background: avatar.bg, color: avatar.fg, width: 32, height: 32, fontSize: 12 }}>
          {firstName ? firstName[0].toUpperCase() : '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--slate-900)' }}>
            {firstName} {visitor.last_name ?? ''}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{time}</div>
        </div>
        <StatusBadge status={visit.status} />
      </div>
      <JourneyTimeline events={events} />
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState(EMPTY_METRICS)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [metricsData, recentData] = await Promise.all([getDashboardMetrics(), getRecentVisitsWithJourney(2)])
      setMetrics(metricsData)
      setRecent(recentData)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={today.charAt(0).toUpperCase() + today.slice(1)} />

      {error ? (
        <KigoError message="No se pudieron cargar las estadísticas. Intenta de nuevo." onRetry={load} />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard title="Visitas hoy" value={metrics.totalToday} icon={IconCalendar} bg="var(--sky-50)" fg="var(--sky-900)" loading={loading} />
            <StatCard title="Activas" value={metrics.active} icon={IconPin} bg="var(--green-100)" fg="var(--green-600)" loading={loading} />
            <StatCard title="Pendientes" value={metrics.pending} icon={IconClock} bg="var(--yellow-50)" fg="#a16207" loading={loading} />
            <StatCard title="Completadas" value={metrics.completed} icon={IconCheckCircle} bg="var(--umbral-100)" fg="var(--slate-500)" loading={loading} />
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-900)', margin: '36px 0 14px' }}>Acceso rápido</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <QuickAction icon={IconUsers} label="Ver todas las visitas" description="Listado completo con filtros" onClick={() => navigate('/visits')} />
            <QuickAction icon={IconClock} label="Pendientes de revisión" description="Requieren autorización" onClick={() => navigate('/visits?filter=pending')} />
            <QuickAction icon={IconPin} label="Visitas activas" description="Actualmente en sitio" onClick={() => navigate('/visits?filter=active')} />
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-900)', margin: '36px 0 14px' }}>Métricas de hoy</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <MetricCard title="TRUST SCORE PROMEDIO" loading={loading}>
              {metrics.avgTrustScore != null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <TrustRing score={metrics.avgTrustScore} size={46} fontSize={14} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: trustColor(metrics.avgTrustScore) }}>
                      {trustLabel(metrics.avgTrustScore)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>
                      {metrics.trustEvaluatedCount} {metrics.trustEvaluatedCount === 1 ? 'evaluación' : 'evaluaciones'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-400)' }}>—</div>
              )}
            </MetricCard>

            <MetricCard title="DURACIÓN PROMEDIO DE VISITA" loading={loading}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--slate-900)' }}>
                {formatMinutes(metrics.avgVisitDurationMinutes)}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Entre check-in y check-out</span>
            </MetricCard>

            <MetricCard title="TIEMPO PROMEDIO DE ESPERA" loading={loading}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--slate-900)' }}>
                {formatMinutes(metrics.avgWaitMinutes)}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>Entre llegada y autorización</span>
            </MetricCard>
          </div>

          <div className="dash-charts-grid">
            <div className="card card-pad">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)' }}>VISITAS · ÚLTIMOS 7 DÍAS</span>
              <div style={{ marginTop: 18 }}>
                {loading ? (
                  <div className="skeleton" style={{ width: '100%', height: 160 }} />
                ) : (
                  <BarChart data={metrics.visitsByDay} />
                )}
              </div>
            </div>

            <div className="card card-pad">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)' }}>CALIDAD DE TRUST SCORE</span>
              <div style={{ marginTop: 18 }}>
                {loading ? (
                  <div className="skeleton" style={{ width: 120, height: 120, borderRadius: '50%' }} />
                ) : metrics.trustEvaluatedCount === 0 ? (
                  <p style={{ fontSize: 12.5, color: 'var(--gray-500)', margin: 0 }}>Sin evaluaciones registradas hoy.</p>
                ) : (
                  <DonutChart
                    segments={[
                      { label: 'Excelente', value: metrics.trustBuckets.excellent, color: 'var(--green-600)' },
                      { label: 'Aceptable', value: metrics.trustBuckets.acceptable, color: '#eab308' },
                      { label: 'Bajo', value: metrics.trustBuckets.low, color: 'var(--red-500)' },
                    ]}
                    size={110}
                    thickness={15}
                  />
                )}
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-900)', margin: '36px 0 14px' }}>Recorrido reciente</h3>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <div className="skeleton" style={{ width: '100%', height: 180, borderRadius: 14 }} />
              <div className="skeleton" style={{ width: '100%', height: 180, borderRadius: 14 }} />
            </div>
          ) : recent.length === 0 ? (
            <div className="table-card">
              <KigoEmpty icon={IconInbox} title="Aún no hay visitas registradas" />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {recent.map(({ visit, events }) => (
                <RecentVisitCard key={visit.id} visit={visit} events={events} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
