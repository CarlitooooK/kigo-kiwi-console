import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, ORGANIZATION_ID } from '../lib/supabase'
import { getVisitsByOrganization } from '../lib/visitRepository'
import { VISIT_FILTERS, avatarColor } from '../lib/status'
import { PERIOD_FILTERS, getPeriodRange } from '../lib/period'
import { ACTIONABLE_STATUSES, latestTrustScore, primaryEvidence, evidenceBucket } from '../lib/visitMeta'
import { trustColor, trustLabel } from '../lib/trust'
import { exportVisitsPdf } from '../lib/exportPdf'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import TrustRing from '../components/TrustRing'
import KigoError from '../components/KigoError'
import KigoEmpty from '../components/KigoEmpty'
import { IconRefresh, IconCalendar, IconImage, IconDownload } from '../components/icons'

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function EvidenceThumb({ url, loading }) {
  if (loading) {
    return <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 8 }} />
  }
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--umbral-100)',
        border: '1px solid var(--umbral-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--gray-400)',
        flexShrink: 0,
      }}
    >
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconImage size={16} />}
    </div>
  )
}

export default function Visits() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterKey = searchParams.get('filter') ?? 'all'
  const periodKey = searchParams.get('period') ?? 'all'
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [photoUrls, setPhotoUrls] = useState({})
  const [photosLoading, setPhotosLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const activeFilter = VISIT_FILTERS.find((f) => f.key === filterKey) ?? VISIT_FILTERS[0]
  const range = getPeriodRange(periodKey)

  async function handleExport() {
    setExporting(true)
    try {
      await exportVisitsPdf({
        visits,
        periodLabel: range?.label ?? 'Todo el historial',
        statusLabel: activeFilter.label,
      })
    } finally {
      setExporting(false)
    }
  }

  function setParam(key, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value == null || value === 'all') next.delete(key)
      else next.set(key, value)
      return next
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getVisitsByOrganization(ORGANIZATION_ID, {
        statusFilter: activeFilter.status,
        from: range?.start,
        to: range?.end,
      })
      setVisits(data)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [activeFilter.status, periodKey])

  useEffect(() => {
    load()
  }, [load])

  // Only resolve signed URLs for visits still in play — no point spending storage
  // requests previewing photos for visits that are already completed/rejected history.
  useEffect(() => {
    const candidates = visits.filter((v) => ACTIONABLE_STATUSES.includes(v.status) && primaryEvidence(v))
    setPhotoUrls({})

    if (candidates.length === 0) {
      setPhotosLoading(false)
      return
    }

    let cancelled = false
    setPhotosLoading(true)

    Promise.allSettled(
      candidates.map(async (visit) => {
        const evidence = primaryEvidence(visit)
        const { data } = await supabase.storage
          .from(evidenceBucket(evidence.type))
          .createSignedUrl(evidence.storage_path, 3600)
        return [visit.id, data?.signedUrl ?? null]
      })
    ).then((results) => {
      if (!cancelled) {
        const entries = results
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value)
        setPhotoUrls(Object.fromEntries(entries))
        setPhotosLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [visits])

  return (
    <div>
      <PageHeader
        title="Visitas"
        subtitle={
          range
            ? `${visits.length} ${visits.length === 1 ? 'registro' : 'registros'} · ${range.label}`
            : `${visits.length} ${visits.length === 1 ? 'registro' : 'registros'}`
        }
        actions={
          <>
            <button className="btn btn-outline" onClick={handleExport} disabled={loading || exporting || visits.length === 0}>
              {exporting ? <span className="spinner spinner-sm" /> : <IconDownload size={16} />}
              {exporting ? 'Exportando…' : 'Exportar PDF'}
            </button>
            <button className="icon-btn" onClick={load} title="Actualizar">
              <IconRefresh size={17} />
            </button>
          </>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 20 }}>
        <div>
          <div className="filter-group-label">Estado</div>
          <div className="seg-tabs">
            {VISIT_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`seg-tab${f.key === filterKey ? ' active' : ''}`}
                onClick={() => setParam('filter', f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="filter-group-label">Periodo</div>
          <div className="seg-tabs">
            {PERIOD_FILTERS.map((p) => (
              <button
                key={p.key}
                className={`seg-tab${p.key === periodKey ? ' active' : ''}`}
                onClick={() => setParam('period', p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="table-card">
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: '35%', height: 13, marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: '20%', height: 11 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="table-card">
          <KigoError message="No se pudieron cargar las visitas. Intenta de nuevo." onRetry={load} />
        </div>
      ) : visits.length === 0 ? (
        <div className="table-card">
          <KigoEmpty
            icon={IconCalendar}
            title={`No hay visitas ${activeFilter.label.toLowerCase()}`}
            subtitle="Cuando se registre una visita que coincida con este filtro, aparecerá aquí."
          />
        </div>
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Visitante</th>
                  <th>Empresa</th>
                  <th>Anfitrión</th>
                  <th>Evidencia</th>
                  <th>Trust Score</th>
                  <th>Hora</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => {
                  const visitor = visit.visitors ?? {}
                  const host = visit.profiles ?? {}
                  const firstName = visitor.first_name ?? ''
                  const lastName = visitor.last_name ?? ''
                  const avatar = avatarColor(firstName)
                  const showPhoto = ACTIONABLE_STATUSES.includes(visit.status) && primaryEvidence(visit)
                  const score = latestTrustScore(visit)

                  return (
                    <tr key={visit.id} onClick={() => navigate(`/visits/${visit.id}`, { state: visit })}>
                      <td>
                        <div className="cell-primary">
                          <div className="avatar" style={{ background: avatar.bg, color: avatar.fg }}>
                            {firstName ? firstName[0].toUpperCase() : '?'}
                          </div>
                          <div>
                            <div className="cell-title">
                              {firstName} {lastName}
                            </div>
                            {visitor.email && <div className="cell-sub">{visitor.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td>{visitor.company || '—'}</td>
                      <td>{host.full_name || '—'}</td>
                      <td>
                        {showPhoto ? (
                          <EvidenceThumb url={photoUrls[visit.id]} loading={photosLoading} />
                        ) : (
                          <span style={{ color: 'var(--gray-400)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {score != null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TrustRing score={score} size={28} fontSize={10} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: trustColor(score) }}>
                              {trustLabel(score)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--gray-400)' }}>—</span>
                        )}
                      </td>
                      <td>{formatTime(visit.created_at)}</td>
                      <td>
                        <StatusBadge status={visit.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
