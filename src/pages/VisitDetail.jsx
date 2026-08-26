import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getVisitDetail } from '../lib/visitRepository'
import { getJourney, logEvent } from '../lib/journeyRepository'
import { useAuth } from '../contexts/AuthContext'
import { trustColor, trustLabel } from '../lib/trust'
import { evidenceBucket, evidenceTypeLabel } from '../lib/visitMeta'
import KigoLoader from '../components/KigoLoader'
import KigoError from '../components/KigoError'
import StatusBadge from '../components/StatusBadge'
import JourneyTimeline from '../components/JourneyTimeline'
import TrustRing from '../components/TrustRing'
import {
  IconArrowLeft,
  IconCheck,
  IconX,
  IconTag,
  IconMail,
  IconPhone,
  IconBuilding,
  IconUser,
  IconCalendar,
  IconPin,
  IconImage,
  IconAlertCircle,
} from '../components/icons'

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '9px 0' }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'var(--umbral-100)',
          color: 'var(--slate-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 13.5, color: 'var(--slate-900)', fontWeight: 500, marginTop: 1 }}>{value}</div>
      </div>
    </div>
  )
}

function SectionCard({ title, children, style }) {
  return (
    <div className="card card-pad" style={{ marginBottom: 20, ...style }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--slate-900)', margin: '0 0 4px' }}>{title}</h3>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  )
}

function formatSchedule(start, end) {
  if (!start) return ''
  const fmt = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  return end ? `${fmt(start)} — ${fmt(end)}` : fmt(start)
}

function EvidenceSection({ evidence, thumbSize = { width: 150, height: 112 } }) {
  const [urls, setUrls] = useState({})
  const [loadingUrls, setLoadingUrls] = useState(true)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadUrls() {
      const results = await Promise.allSettled(
        evidence.map(async (item) => {
          const storagePath = item.storage_path
          const type = item.type
          if (!storagePath || !type) return null
          const { data } = await supabase.storage.from(evidenceBucket(type)).createSignedUrl(storagePath, 3600)
          return [storagePath, data?.signedUrl ?? null]
        })
      )
      const next = Object.fromEntries(
        results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value)
      )
      if (!cancelled) {
        setUrls(next)
        setLoadingUrls(false)
      }
    }

    if (evidence.length > 0) loadUrls()
    else setLoadingUrls(false)

    return () => {
      cancelled = true
    }
  }, [evidence])

  if (loadingUrls) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {evidence.map((_, i) => (
          <div key={i} className="skeleton" style={{ width: thumbSize.width, height: thumbSize.height, borderRadius: 10 }} />
        ))}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {evidence.map((item, i) => {
          const url = item.storage_path ? urls[item.storage_path] : null
          return (
            <div key={i}>
              <div
                onClick={() => url && setPreview(url)}
                style={{
                  width: thumbSize.width,
                  height: thumbSize.height,
                  borderRadius: 10,
                  border: '1px solid var(--umbral-200)',
                  background: 'var(--umbral-100)',
                  overflow: 'hidden',
                  cursor: url ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gray-400)',
                }}
              >
                {url ? (
                  <img src={url} alt={evidenceTypeLabel(item.type)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <IconImage size={22} />
                )}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--gray-500)', fontWeight: 500, marginTop: 7, textAlign: 'center' }}>
                {evidenceTypeLabel(item.type)}
              </div>
            </div>
          )
        })}
      </div>

      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,43,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
            cursor: 'zoom-out',
          }}
        >
          <img src={preview} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 14, boxShadow: 'var(--shadow-lg)' }} />
        </div>
      )}
    </>
  )
}

export default function VisitDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [visit, setVisit] = useState(null)
  const [journeyEvents, setJourneyEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, journey] = await Promise.all([getVisitDetail(id), getJourney(id)])
      setVisit(data)
      setJourneyEvents(journey)
    } catch (e) {
      setError('No se pudo cargar el detalle. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  async function authorize() {
    setActioning(true)
    try {
      await supabase.from('access_decisions').insert({
        visit_id: id,
        decision: 'GRANTED',
        decided_by: 'HOST',
        decided_by_user_id: user?.id,
        reason: 'Authorized from console',
      })

      await supabase
        .from('visits')
        .update({ status: 'ACTIVE', checked_in_at: new Date().toISOString() })
        .eq('id', id)

      await logEvent({ visitId: id, eventType: 'HOST_APPROVED', payload: { from: 'console', user_id: user?.id } })
      await logEvent({ visitId: id, eventType: 'CHECKED_IN' })

      setToast({ type: 'success', message: 'Visita autorizada correctamente' })
      load()
    } catch (e) {
      setToast({ type: 'error', message: `No se pudo autorizar la visita. Intenta de nuevo. (${e.message})` })
    } finally {
      setActioning(false)
    }
  }

  async function reject() {
    const reason = window.prompt('Motivo del rechazo (opcional)') ?? null
    if (reason === null) return

    setActioning(true)
    try {
      await supabase.from('access_decisions').insert({
        visit_id: id,
        decision: 'DENIED',
        decided_by: 'HOST',
        decided_by_user_id: user?.id,
        reason: reason || 'Rejected from console',
      })

      await supabase.from('visits').update({ status: 'REJECTED' }).eq('id', id)

      await logEvent({ visitId: id, eventType: 'HOST_REJECTED', payload: { from: 'console', reason } })

      setToast({ type: 'warning', message: 'Visita rechazada' })
      load()
    } catch (e) {
      setToast({ type: 'error', message: `No se pudo rechazar. Intenta de nuevo. (${e.message})` })
    } finally {
      setActioning(false)
    }
  }

  if (loading) return <KigoLoader message="Cargando detalle" />
  if (error) return <KigoError message={error} onRetry={load} />
  if (!visit) return null

  const visitor = visit.visitors ?? {}
  const host = visit.profiles ?? {}
  const trustEvals = visit.trust_evaluations ?? []
  const evidence = visit.visit_evidence ?? []
  const status = visit.status ?? ''
  const trustScore = trustEvals.length > 0 ? Number(trustEvals[trustEvals.length - 1].score) : null
  const canAuthorize = ['PENDING', 'PRE_AUTHORIZED', 'IN_PROGRESS'].includes(status)

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="btn-ghost"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 0', marginBottom: 16, cursor: 'pointer', border: 'none', background: 'none', fontSize: 13, fontWeight: 500 }}
      >
        <IconArrowLeft size={16} />
        Volver a visitas
      </button>

      <div className="page-header">
        <div>
          <h1>
            {visitor.first_name} {visitor.last_name}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <StatusBadge status={status} />
            {visit.source && (
              <span className="badge" style={{ background: 'var(--umbral-100)', color: 'var(--slate-500)' }}>
                <IconTag size={11} />
                {visit.source}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <SectionCard title="Visitante">
            <InfoRow icon={IconUser} label="Nombre" value={`${visitor.first_name ?? ''} ${visitor.last_name ?? ''}`} />
            {visitor.company && <InfoRow icon={IconBuilding} label="Empresa" value={visitor.company} />}
            {visitor.email && <InfoRow icon={IconMail} label="Correo" value={visitor.email} />}
            {visitor.phone && <InfoRow icon={IconPhone} label="Teléfono" value={visitor.phone} />}
            {visitor.visitor_type && <InfoRow icon={IconTag} label="Tipo" value={visitor.visitor_type} />}
          </SectionCard>

          <SectionCard title="Visita">
            <InfoRow icon={IconUser} label="Anfitrión" value={host.full_name ?? 'No asignado'} />
            {visit.purpose && <InfoRow icon={IconTag} label="Motivo" value={visit.purpose} />}
            {visit.area && <InfoRow icon={IconPin} label="Área" value={visit.area} />}
            {visit.scheduled_start && (
              <InfoRow icon={IconCalendar} label="Horario" value={formatSchedule(visit.scheduled_start, visit.scheduled_end)} />
            )}
          </SectionCard>

          <SectionCard title="Recorrido de visita" style={{ marginBottom: 0 }}>
            <JourneyTimeline events={journeyEvents} />
          </SectionCard>
        </div>

        {/* Decision panel: trust score, captured evidence and actions together — no scrolling needed to review. */}
        <div className="detail-side">
          {trustScore != null && (
            <div className="card card-pad" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--slate-900)', margin: '0 0 16px' }}>
                Trust Score
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <TrustRing score={trustScore} size={64} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: trustColor(trustScore) }}>
                    {trustLabel(trustScore)}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 2, lineHeight: 1.4 }}>
                    Calidad de registro y evidencia
                  </div>
                </div>
              </div>
            </div>
          )}

          {evidence.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--slate-900)', margin: '0 0 14px' }}>
                Evidencia
              </h3>
              <EvidenceSection evidence={evidence} thumbSize={{ width: 118, height: 88 }} />
            </div>
          )}

          {canAuthorize && (
            <div className="card card-pad">
              <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--slate-900)', margin: '0 0 4px' }}>
                Acciones
              </h3>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '0 0 16px' }}>
                Decide si esta visita puede acceder a las instalaciones.
              </p>
              {actioning ? (
                <KigoLoader message="Procesando acción" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={authorize} className="btn btn-success" style={{ width: '100%' }}>
                    <IconCheck size={16} />
                    Autorizar
                  </button>
                  <button onClick={reject} className="btn btn-outline-danger" style={{ width: '100%' }}>
                    <IconX size={16} />
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          className="toast"
          style={{
            background:
              toast.type === 'success' ? 'var(--green-600)' : toast.type === 'warning' ? '#a16207' : 'var(--red-500)',
          }}
        >
          {toast.type === 'error' && <IconAlertCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
