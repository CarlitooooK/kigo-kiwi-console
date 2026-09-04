import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getVisitDetail } from '../lib/visitRepository'
import { getJourney, logEvent } from '../lib/journeyRepository'
import { hasFaceEnrollment, unenrollFace, markRecurrent } from '../lib/hostActions'
import { statusMeta } from '../lib/status'
import { trustColor, trustLabel } from '../lib/trust'
import { evidenceBucket, evidenceTypeLabel, latestTrustScore } from '../lib/visitMeta'
import { bridgeToast, bridgeClose, bridgeAuthUserId } from '../lib/kigoBridge'
import KigoLoader from '../components/KigoLoader'
import KigoError from '../components/KigoError'
import TrustRing from '../components/TrustRing'
import JourneyTimeline from '../components/JourneyTimeline'
import { IconCheck, IconX, IconLogout, IconUser, IconBuilding, IconPin, IconTag, IconImage, IconPhone, IconArrowLeft } from '../components/icons'

/// Host authorization mini-app — designed to run embedded in the Kigo app
/// (KigoWebViewScreen) or standalone in a browser. Pure Supabase logic; the
/// Kigo bridge is used only to close/toast when embedded.
///
/// When [readOnly] is true it renders a visitor-facing, read-only view: same
/// data (status, trust, evidence, timeline) but no authorize/reject/checkout
/// actions — used by the badge QR so a visitor can follow their own visit.
export default function HostAuthorize({ readOnly = false }) {
  const params = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const visitId = params.id ?? search.get('visit')
  // Opened from the host console-lite? Then show a back button and, after an
  // action, return to the list instead of trying to close the whole mini-app.
  const fromHost = search.get('from') === 'host'

  const [visit, setVisit] = useState(null)
  const [journey, setJourney] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState(false)
  // Face enrollment status of this visit's visitor (for un-enroll / recurrent).
  const [enrollment, setEnrollment] = useState(null) // false | {id,isRecurrent}
  const [done, setDone] = useState(null) // 'granted' | 'denied' | 'checkedout'
  const [evidenceUrls, setEvidenceUrls] = useState({})
  // Fullscreen photo viewer (tap a thumbnail to open).
  const [preview, setPreview] = useState(null)
  // Host verification: 'match' | 'mismatch' | 'unverified' (standalone/no bridge)
  const [hostCheck, setHostCheck] = useState('unverified')

  const load = useCallback(async () => {
    if (!visitId) {
      setError('Falta el identificador de la visita.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [data, j] = await Promise.all([getVisitDetail(visitId), getJourney(visitId)])
      setVisit(data)
      setJourney(j)

      // Face enrollment status of this visitor (for un-enroll / recurrent).
      const visitorId = data?.visitors?.id
      if (visitorId) {
        setEnrollment(await hasFaceEnrollment(visitorId))
      }

      // Which Kigo host is this visit addressed to? (written by the kiosk in
      // the VISIT_CREATED event). Compare against the viewer's bridge identity.
      const created = (j ?? []).find((e) => e.event_type === 'VISIT_CREATED')
      const intendedHost = created?.payload?.host_kigo_user_id ?? null
      const viewer = await bridgeAuthUserId()
      if (viewer == null || intendedHost == null) {
        // Standalone browser, or visit without a host id → can't verify.
        setHostCheck('unverified')
      } else {
        setHostCheck(String(viewer) === String(intendedHost) ? 'match' : 'mismatch')
      }
    } catch {
      setError('No se pudo cargar la visita. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [visitId])

  useEffect(() => { load() }, [load])

  // Signed URLs for evidence thumbnails.
  useEffect(() => {
    const evidence = visit?.visit_evidence ?? []
    if (evidence.length === 0) return
    let cancelled = false
    Promise.allSettled(
      evidence.map(async (e) => {
        if (!e.storage_path || !e.type) return null
        const { data } = await supabase.storage.from(evidenceBucket(e.type)).createSignedUrl(e.storage_path, 3600)
        return [e.storage_path, data?.signedUrl ?? null]
      })
    ).then((res) => {
      if (cancelled) return
      setEvidenceUrls(Object.fromEntries(res.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value)))
    })
    return () => { cancelled = true }
  }, [visit])

  async function authorize() {
    setActing(true)
    try {
      await supabase.from('access_decisions').insert({
        visit_id: visitId, decision: 'GRANTED', decided_by: 'HOST',
        reason: 'Authorized from Kigo mini-app',
      })
      await supabase.from('visits').update({ status: 'ACTIVE', checked_in_at: new Date().toISOString() }).eq('id', visitId)
      await logEvent({ visitId, eventType: 'HOST_APPROVED', payload: { from: 'kigo_miniapp' } })
      await logEvent({ visitId, eventType: 'CHECKED_IN' })
      setDone('granted')
      await bridgeToast('Visita autorizada', 'success')
      // No auto-close: the host may want to send the WhatsApp to the visitor
      // first. Closing is done via the explicit button on the success screen.
    } catch (e) {
      await bridgeToast('No se pudo autorizar', 'error')
      setError(`No se pudo autorizar. (${e.message})`)
    } finally {
      setActing(false)
    }
  }

  async function reject() {
    setActing(true)
    try {
      await supabase.from('access_decisions').insert({
        visit_id: visitId, decision: 'DENIED', decided_by: 'HOST',
        reason: 'Rejected from Kigo mini-app',
      })
      await supabase.from('visits').update({ status: 'REJECTED' }).eq('id', visitId)
      await logEvent({ visitId, eventType: 'HOST_REJECTED', payload: { from: 'kigo_miniapp' } })
      setDone('denied')
      await bridgeToast('Visita rechazada', 'warning')
      if (fromHost) setTimeout(() => navigate('/host'), 1200)
      else setTimeout(() => bridgeClose('rejected'), 1500)
    } catch (e) {
      setError(`No se pudo rechazar. (${e.message})`)
    } finally {
      setActing(false)
    }
  }

  async function checkOut() {
    setActing(true)
    try {
      await supabase.from('visits').update({ status: 'COMPLETED', checked_out_at: new Date().toISOString() }).eq('id', visitId)
      await logEvent({ visitId, eventType: 'CHECKED_OUT', payload: { from: 'kigo_miniapp' } })
      setDone('checkedout')
      await bridgeToast('Salida registrada', 'success')
      if (fromHost) setTimeout(() => navigate('/host'), 1200)
      else setTimeout(() => bridgeClose('checked_out'), 1500)
    } catch (e) {
      setError(`No se pudo registrar la salida. (${e.message})`)
    } finally {
      setActing(false)
    }
  }

  async function onUnenroll() {
    const visitorId = visit?.visitors?.id
    if (!visitorId) return
    setActing(true)
    try {
      await unenrollFace(visitorId)
      setEnrollment(false)
      await bridgeToast('Rostro eliminado', 'success')
    } catch (e) {
      setError(`No se pudo eliminar el rostro. (${e.message})`)
    } finally {
      setActing(false)
    }
  }

  async function onToggleRecurrent() {
    const visitorId = visit?.visitors?.id
    if (!visitorId || !enrollment) return
    setActing(true)
    try {
      const next = !enrollment.isRecurrent
      await markRecurrent(visitorId, next)
      setEnrollment({ ...enrollment, isRecurrent: next })
      await bridgeToast(next ? 'Marcado como recurrente' : 'Ya no es recurrente', 'success')
    } catch (e) {
      setError(`No se pudo actualizar. (${e.message})`)
    } finally {
      setActing(false)
    }
  }

  if (loading) return <div className="miniapp"><KigoLoader message="Cargando visita" /></div>
  if (error) return <div className="miniapp"><KigoError message={error} onRetry={load} /></div>
  if (!visit) return null

  const visitor = visit.visitors ?? {}
  const status = visit.status ?? ''
  const meta = statusMeta(status)
  const score = latestTrustScore(visit)
  const evidence = visit.visit_evidence ?? []
  // The host only decides on walk-ins that actually reached the host step
  // (event HOST_NOTIFIED). Invitations are pre-authorized and enter directly,
  // so they never show an "Authorize" button.
  const hostNotified = (journey ?? []).some((e) => e.event_type === 'HOST_NOTIFIED')
  const isPreauthorized = visit.is_preauthorized === true
  const canDecide = !readOnly && !isPreauthorized && hostNotified &&
      ['PENDING', 'IN_PROGRESS'].includes(status)
  const canCheckOut = !readOnly && ['ACTIVE', 'CHECKED_IN'].includes(status)

  return (
    <div className="miniapp" style={{ maxWidth: 460, margin: '0 auto', padding: 20 }}>
      {fromHost && !done && (
        <button
          onClick={() => navigate('/host')}
          className="btn btn-ghost"
          style={{ padding: '4px 8px', marginBottom: 4 }}
        >
          <IconArrowLeft size={16} /> Mis visitas
        </button>
      )}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--kigo-500)' }}>Kigo Welcome</span>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--slate-900)', textAlign: 'center', margin: '0 0 4px' }}>
        {done ? _doneTitle(done) : readOnly ? 'Tu visita' : 'Solicitud de acceso'}
      </h1>

      {done ? (
        <>
          <p style={{ textAlign: 'center', color: 'var(--slate-500)', fontSize: 15 }}>{_doneMessage(done)}</p>
          {done === 'granted' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              {(visitor.phone ?? '').trim() !== '' ? (
                <a
                  href={_whatsappLink(visitor.phone, visit, visitId)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-success"
                  style={{ width: '100%', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  Enviar WhatsApp al visitante
                </a>
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: 12.5, margin: 0 }}>
                  El visitante no registró teléfono para enviarle WhatsApp.
                </p>
              )}
              <button onClick={() => fromHost ? navigate('/host') : bridgeClose('authorized')} className="btn btn-outline" style={{ width: '100%' }}>
                {fromHost ? 'Volver a mis visitas' : 'Cerrar'}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
            <span className="badge" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
          </div>

          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <Row icon={IconUser} label="Visitante" value={`${visitor.first_name ?? ''} ${visitor.last_name ?? ''}`.trim() || '—'} />
            {visitor.company && <Row icon={IconBuilding} label="Empresa" value={visitor.company} />}
            {visitor.visitor_type && <Row icon={IconTag} label="Tipo" value={visitor.visitor_type} />}
            {visitor.phone && <Row icon={IconPhone} label="Celular" value={visitor.phone} />}
            {visit.purpose && <Row icon={IconTag} label="Motivo" value={visit.purpose} />}
            {visit.area && <Row icon={IconPin} label="Área" value={visit.area} />}
          </div>

          {score != null && (
            <div className="card card-pad" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <TrustRing score={score} size={56} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: trustColor(score) }}>{trustLabel(score)}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Calidad de registro y evidencia</div>
              </div>
            </div>
          )}

          {evidence.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Evidencia</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {evidence.map((e, i) => {
                  const url = e.storage_path ? evidenceUrls[e.storage_path] : null
                  return (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div
                        onClick={() => url && setPreview(url)}
                        style={{ width: 96, height: 72, borderRadius: 10, overflow: 'hidden', background: 'var(--umbral-100)', border: '1px solid var(--umbral-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', cursor: url ? 'zoom-in' : 'default' }}
                      >
                        {url ? <img src={url} alt={evidenceTypeLabel(e.type)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconImage size={20} />}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--gray-500)', marginTop: 4 }}>{evidenceTypeLabel(e.type)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {journey.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Recorrido</h3>
              <JourneyTimeline events={journey} />
            </div>
          )}

          {!readOnly && enrollment && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>Rostro registrado</h3>
              <p style={{ fontSize: 12.5, color: 'var(--gray-500)', margin: '0 0 12px' }}>
                {enrollment.isRecurrent
                  ? 'Este visitante puede entrar con su rostro (recurrente).'
                  : 'Rostro guardado para agilizar futuras visitas.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={onToggleRecurrent} className="btn btn-outline" style={{ width: '100%' }} disabled={acting}>
                  {enrollment.isRecurrent ? 'Quitar acceso recurrente' : 'Marcar como recurrente'}
                </button>
                <button onClick={onUnenroll} className="btn btn-outline-danger" style={{ width: '100%' }} disabled={acting}>
                  <IconX size={16} /> Eliminar rostro registrado
                </button>
              </div>
            </div>
          )}

          {acting ? (
            <KigoLoader message="Procesando" />
          ) : hostCheck === 'mismatch' ? (
            <div className="card card-pad" style={{ textAlign: 'center', borderColor: 'var(--yellow-50)' }}>
              <p style={{ fontSize: 13.5, color: '#a16207', margin: 0 }}>
                Esta visita está dirigida a otro anfitrión. No puedes autorizarla desde tu cuenta.
              </p>
            </div>
          ) : canDecide ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={authorize} className="btn btn-success" style={{ width: '100%' }}>
                <IconCheck size={16} /> Autorizar acceso
              </button>
              <button onClick={reject} className="btn btn-outline-danger" style={{ width: '100%' }}>
                <IconX size={16} /> Rechazar
              </button>
            </div>
          ) : canCheckOut ? (
            <button onClick={checkOut} className="btn btn-primary" style={{ width: '100%' }}>
              <IconLogout size={16} /> Registrar salida
            </button>
          ) : readOnly ? (
            <div className="card card-pad" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13.5, color: 'var(--slate-500)', margin: 0 }}>
                {_visitorStatusMessage(status)}
              </p>
            </div>
          ) : isPreauthorized && ['PENDING', 'PRE_AUTHORIZED'].includes(status) ? (
            <div className="card card-pad" style={{ textAlign: 'center', borderColor: 'var(--green-100)' }}>
              <p style={{ fontSize: 13.5, color: 'var(--green-600)', margin: 0, fontWeight: 600 }}>
                Invitación · acceso directo
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--gray-500)', margin: '6px 0 0' }}>
                El visitante entra directo al escanear su QR. No requiere tu autorización.
              </p>
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>
              Esta visita ya no requiere acción.
            </p>
          )}
        </>
      )}

      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,43,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 20, cursor: 'zoom-out',
          }}
        >
          <img
            src={preview}
            alt=""
            style={{ maxWidth: '96vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 0' }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--umbral-100)', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={13} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--slate-900)', fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  )
}

function _doneTitle(d) {
  if (d === 'granted') return 'Acceso autorizado'
  if (d === 'denied') return 'Visita rechazada'
  return 'Salida registrada'
}
function _doneMessage(d) {
  if (d === 'granted') return 'El visitante puede pasar. Gracias.'
  if (d === 'denied') return 'Se notificó que la visita no fue autorizada.'
  return 'La visita se marcó como completada.'
}

// Builds a wa.me link with an approval message + the visit-follow QR link.
function _whatsappLink(phone, visit, visitId) {
  // Normalize to digits; assume Mexico (+52) when only a 10-digit local number.
  let digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length === 10) digits = `52${digits}`

  const name = (visit?.visitors?.first_name ?? '').trim()
  const company = (visit?.visitors?.company ?? '').trim()
  const follow = `https://parkimovil.com/app?qr=WELCOME:${visitId}`
  const lines = [
    `Hola${name ? ' ' + name : ''}, tu visita fue aprobada.`,
    company ? `Empresa: ${company}` : null,
    visit?.area ? `Área: ${visit.area}` : null,
    'Sigue el estado de tu visita aquí:',
    follow,
  ].filter(Boolean)
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`
}

// Visitor-facing status copy for the read-only QR view.
function _visitorStatusMessage(status) {
  switch (status) {
    case 'ACTIVE':
    case 'CHECKED_IN':
      return 'Tu visita está activa. ¡Bienvenido!'
    case 'PENDING':
    case 'PRE_AUTHORIZED':
    case 'IN_PROGRESS':
      return 'Tu solicitud está en proceso. Espera la autorización de tu anfitrión.'
    case 'COMPLETED':
      return 'Tu visita ha finalizado. ¡Gracias por tu visita!'
    case 'REJECTED':
      return 'Tu visita no fue autorizada. Acude a recepción para más información.'
    default:
      return 'Estado de tu visita.'
  }
}
