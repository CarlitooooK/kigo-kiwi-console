import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTodayVisitsForHost, getInvitationsForHost } from '../lib/visitRepository'
import { approveVisit, checkOutVisit, whatsappLink, hasFaceEnrollment, markRecurrent } from '../lib/hostActions'
import { bridgeAuthUserId, bridgeToast } from '../lib/kigoBridge'
import { statusMeta, avatarColor } from '../lib/status'
import KigoLoader from '../components/KigoLoader'
import KigoError from '../components/KigoError'
import KigoEmpty from '../components/KigoEmpty'
import {
  IconCheck, IconLogout, IconPhone, IconRefresh, IconUser, IconTag, IconPin, IconClock,
  IconEye, IconChevronRight,
} from '../components/icons'

// Organization for the FEPRO demo (same as the kiosk).
const ORG_ID = 'a0000000-0000-0000-0000-000000000001'

// Auto-approval: when enabled, pending walk-ins that already notified the host
// AND scored at/above this trust threshold are approved automatically.
const AUTO_APPROVE_THRESHOLD = 70
const AUTO_APPROVE_KEY = 'kigo_host_auto_approve'

/** Most recent trust score (0–100) for a visit, or null if not evaluated yet. */
function trustScore(visit) {
  const evals = visit?.trust_evaluations
  if (!evals) return null
  const arr = Array.isArray(evals) ? evals : [evals]
  if (arr.length === 0) return null
  const latest = [...arr].sort(
    (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0)
  )[0]
  const score = latest?.score
  return typeof score === 'number' ? score : null
}

const TABS = [
  { key: 'pending', label: 'Pendientes', statuses: ['IN_PROGRESS', 'PENDING', 'PRE_AUTHORIZED'] },
  { key: 'active', label: 'Activas', statuses: ['ACTIVE', 'CHECKED_IN'] },
  { key: 'completed', label: 'Completadas', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Canceladas', statuses: ['CANCELLED', 'REJECTED'] },
  { key: 'invitations', label: 'Invitaciones', statuses: [] },
]

/// Host console-lite — designed to run embedded in the Kigo app (WebView).
///
/// Shows TODAY's visits addressed to the signed-in host, grouped into
/// Pendientes / Activas / Completadas. The host can approve pending visits,
/// check out active ones, and send a WhatsApp to the visitor (available for
/// both pending-approved and active visits). Read-only for completed.
export default function HostConsole() {
  const navigate = useNavigate()
  const [visits, setVisits] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('pending')
  const [actingId, setActingId] = useState(null)
  // Auto-approval toggle, persisted per-device in localStorage.
  const [autoApprove, setAutoApprove] = useState(() => {
    try { return localStorage.getItem(AUTO_APPROVE_KEY) === '1' } catch { return false }
  })
  // Ids the console auto-approved this session (to show a note + avoid re-runs).
  const [autoApprovedIds, setAutoApprovedIds] = useState(() => new Set())
  // Guards in-flight auto-approvals so the effect never fires twice for one id.
  const autoApprovingRef = useRef(new Set())

  const toggleAutoApprove = useCallback(() => {
    setAutoApprove((on) => {
      const next = !on
      try { localStorage.setItem(AUTO_APPROVE_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }, [])
  // After checkout, if the visitor has a face enrollment, ask the host whether
  // to mark them as recurrent (so they can enter with their face next time).
  const [recurrentPrompt, setRecurrentPrompt] = useState(null) // { visit }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const hostId = await bridgeAuthUserId() // null in a plain browser
      // NOTE: ghost-visit cleanup now runs server-side via pg_cron (see
      // docs/expire_stale_visits.sql): PENDING/IN_PROGRESS → CANCELLED after
      // 10 min, ACTIVE/CHECKED_IN after 8h. No client-side sweep needed.
      const [data, invites] = await Promise.all([
        getTodayVisitsForHost(ORG_ID, hostId),
        getInvitationsForHost(ORG_ID, hostId),
      ])
      setVisits(data)
      setInvitations(invites)
    } catch {
      setError('No se pudieron cargar tus visitas de hoy. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const g = { pending: [], active: [], completed: [], cancelled: [], invitations }
    for (const v of visits) {
      // The invitations tab is populated separately (all-time invites).
      const t = TABS.find((x) => x.key !== 'invitations' && x.statuses.includes(v.status))
      if (t) g[t.key].push(v)
    }
    return g
  }, [visits, invitations])

  // Which pending visits qualify for auto-approval right now: they reached the
  // host step (hostNotified), aren't pre-authorized invitations (those enter
  // on their own), are still pending, and scored at/above the threshold.
  function isAutoApprovable(v) {
    const score = trustScore(v)
    return (
      v.hostNotified &&
      !v.is_preauthorized &&
      ['IN_PROGRESS', 'PENDING'].includes(v.status) &&
      score != null &&
      score >= AUTO_APPROVE_THRESHOLD
    )
  }

  // Auto-approval engine. Runs whenever the toggle is on and the visit list
  // refreshes. Approves each eligible visit exactly once (guarded by a ref),
  // then reloads so the kiosk's polling picks up HOST_APPROVED.
  useEffect(() => {
    if (!autoApprove) return
    const pending = groups.pending ?? []
    const targets = pending.filter(
      (v) => isAutoApprovable(v) && !autoApprovingRef.current.has(v.id)
    )
    if (targets.length === 0) return

    let cancelled = false
    ;(async () => {
      for (const v of targets) {
        autoApprovingRef.current.add(v.id)
        try {
          await approveVisit(v.id)
          if (cancelled) return
          setAutoApprovedIds((prev) => new Set(prev).add(v.id))
          await bridgeToast(
            `Auto-aprobada: ${v.visitors?.first_name ?? 'visita'} (Trust ${trustScore(v)})`,
            'success'
          )
        } catch {
          // Allow a later retry if it failed (e.g. transient network).
          autoApprovingRef.current.delete(v.id)
        }
      }
      if (!cancelled) await load()
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApprove, groups.pending])

  async function onApprove(visit) {
    setActingId(visit.id)
    try {
      await approveVisit(visit.id)
      await bridgeToast('Visita autorizada', 'success')
      await load()
      setTab('active')
    } catch (e) {
      await bridgeToast('No se pudo autorizar', 'error')
      setError(`No se pudo autorizar. (${e.message})`)
    } finally {
      setActingId(null)
    }
  }

  async function onCheckOut(visit) {
    setActingId(visit.id)
    try {
      await checkOutVisit(visit.id)
      await bridgeToast('Salida registrada', 'success')
      // If the visitor has a face enrollment (and isn't already recurrent),
      // offer to mark them recurrent for face-based entry next time.
      const visitorId = visit.visitors?.id
      const enroll = await hasFaceEnrollment(visitorId)
      if (enroll && !enroll.isRecurrent) {
        setRecurrentPrompt({ visit })
      }
      await load()
      setTab('completed')
    } catch (e) {
      await bridgeToast('No se pudo registrar la salida', 'error')
      setError(`No se pudo registrar la salida. (${e.message})`)
    } finally {
      setActingId(null)
    }
  }

  async function confirmRecurrent(recurrent) {
    const visit = recurrentPrompt?.visit
    setRecurrentPrompt(null)
    if (!visit || !recurrent) return
    try {
      await markRecurrent(visit.visitors?.id, true)
      await bridgeToast('Marcado como recurrente', 'success')
      await load()
    } catch (e) {
      setError(`No se pudo marcar recurrente. (${e.message})`)
    }
  }

  const list = groups[tab] ?? []

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Kigo Welcome" width={34} height={34} style={{ borderRadius: 8 }} />
          <div>
            <div style={S.title}>Mis visitas de hoy</div>
            <div style={S.subtitle}>{_todayLabel()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className="btn btn-primary" onClick={() => navigate('/invite')} style={{ height: 34, padding: '0 12px' }}>
            <IconUser width={16} height={16} /> Invitar
          </button>
          <button className="btn btn-ghost" onClick={load} style={{ padding: 8 }} aria-label="Actualizar">
            <IconRefresh width={18} height={18} />
          </button>
        </div>
      </div>

      {/* Auto-approval toggle */}
      <div style={S.autoRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <IconCheck width={16} height={16} style={{ color: autoApprove ? 'var(--green-600)' : 'var(--gray-500)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={S.autoTitle}>Auto-aprobar visitas</div>
            <div style={S.autoSub}>Concede acceso automático si el Trust Score ≥ {AUTO_APPROVE_THRESHOLD}</div>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={autoApprove}
          onClick={toggleAutoApprove}
          style={{ ...S.switch, ...(autoApprove ? S.switchOn : {}) }}
        >
          <span style={{ ...S.knob, ...(autoApprove ? S.knobOn : {}) }} />
        </button>
      </div>

      <div style={S.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ ...S.tab, ...(tab === t.key ? S.tabActive : {}) }}
          >
            {t.label}
            <span style={{ ...S.count, ...(tab === t.key ? S.countActive : {}) }}>
              {(groups[t.key] ?? []).length}
            </span>
          </button>
        ))}
      </div>

      {error && <div style={{ padding: '0 16px' }}><KigoError message={error} onRetry={load} /></div>}

      {loading ? (
        <KigoLoader message="Cargando tus visitas" />
      ) : list.length === 0 ? (
        <div style={{ padding: 24 }}>
          <KigoEmpty title={_emptyMessage(tab)} />
        </div>
      ) : (
        <div style={S.list}>
          {list.map((v) =>
            tab === 'invitations' ? (
              <InvitationCard key={v.id} visit={v} onOpen={() => navigate(`/authorize/${v.id}?from=host`)} />
            ) : (
              <VisitCard
                key={v.id}
                visit={v}
                tab={tab}
                busy={actingId === v.id}
                autoApproved={autoApprovedIds.has(v.id)}
                onOpen={() => navigate(`/authorize/${v.id}?from=host`)}
                onApprove={() => onApprove(v)}
                onCheckOut={() => onCheckOut(v)}
              />
            )
          )}
        </div>
      )}

      {recurrentPrompt && (
        <div style={S.modalOverlay} onClick={() => confirmRecurrent(false)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...S.iconBadge }}><IconUser width={22} height={22} /></div>
            <div style={S.modalTitle}>¿Marcar como recurrente?</div>
            <div style={S.modalBody}>
              {`${recurrentPrompt.visit.visitors?.first_name ?? 'Este visitante'} podrá entrar con su rostro en futuras visitas, sin registrarse de nuevo.`}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => confirmRecurrent(false)}>
                Ahora no
              </button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => confirmRecurrent(true)}>
                <IconCheck width={16} height={16} /> Sí, marcar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VisitCard({ visit, tab, busy, autoApproved, onOpen, onApprove, onCheckOut }) {
  const visitor = visit.visitors ?? {}
  const name = `${visitor.first_name ?? ''} ${visitor.last_name ?? ''}`.trim() || 'Visitante'
  const meta = statusMeta(visit.status)
  const av = avatarColor(name)
  const initial = name[0]?.toUpperCase() ?? '?'
  const hasPhone = (visitor.phone ?? '').trim() !== ''
  const trust = trustScore(visit)

  return (
    <div className="card card-pad" style={S.card}>
      {/* Tap the body to open the full detail (photos, journey, trust). */}
      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div style={S.cardTop}>
          <div style={{ ...S.avatar, background: av.bg, color: av.fg }}>{initial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.name}>{name}</div>
            <div style={S.metaRow}>
              {visitor.company && <span style={S.metaItem}><IconTag width={13} height={13} /> {visitor.company}</span>}
              {visit.area && <span style={S.metaItem}><IconPin width={13} height={13} /> {visit.area}</span>}
              {trust != null && (
                <span style={{ ...S.trustChip, ...(trust >= AUTO_APPROVE_THRESHOLD ? S.trustHigh : S.trustLow) }}>
                  Trust {trust}
                </span>
              )}
            </div>
          </div>
          <span className="badge" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
        </div>

        {(visit.purpose || hasPhone) && (
          <div style={S.detail}>
            {hasPhone && <div style={S.detailItem}><IconPhone width={14} height={14} /> {visitor.phone}</div>}
            {visit.purpose && <div style={S.detailItem}><IconUser width={14} height={14} /> {visit.purpose}</div>}
            <div style={S.detailItem}><IconClock width={14} height={14} /> {_time(visit.created_at)}</div>
          </div>
        )}

        <div style={S.seeMore}>
          <IconEye width={13} height={13} /> Ver detalle, fotos y trust
          <IconChevronRight width={14} height={14} />
        </div>
      </div>

      {tab === 'pending' && (
        autoApproved ? (
          <div style={S.infoHint}>
            <IconCheck width={13} height={13} /> Auto-aprobada por Trust ≥ {AUTO_APPROVE_THRESHOLD}
          </div>
        ) : visit.hostNotified ? (
          // Walk-in that reached the host-authorization step: show actions.
          <div style={S.actions}>
            <button className="btn btn-success" style={{ flex: 1 }} disabled={busy} onClick={onApprove}>
              <IconCheck width={16} height={16} /> {busy ? 'Autorizando…' : 'Aprobar'}
            </button>
            {hasPhone && <WhatsAppButton visit={visit} />}
          </div>
        ) : visit.is_preauthorized ? (
          // Invitation (pre-authorized): enters directly at the kiosk, no host
          // approval needed → no approve button, just an informative note.
          <div style={S.infoHint}>
            <IconCheck width={13} height={13} /> Invitación · acceso directo al llegar
          </div>
        ) : (
          // Walk-in not yet at the host step.
          <div style={S.waitHint}>
            <IconClock width={13} height={13} /> Aún no llega al kiosko. Podrás autorizar cuando el visitante se registre.
          </div>
        )
      )}

      {tab === 'active' && (
        <div style={S.actions}>
          <button className="btn btn-outline-danger" style={{ flex: 1 }} disabled={busy} onClick={onCheckOut}>
            <IconLogout width={16} height={16} /> {busy ? 'Registrando…' : 'Dar salida'}
          </button>
          {hasPhone && <WhatsAppButton visit={visit} />}
        </div>
      )}
    </div>
  )
}

function WhatsAppButton({ visit }) {
  return (
    <a
      className="btn btn-outline"
      href={whatsappLink(visit, visit.id)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ flex: 1, textDecoration: 'none' }}
    >
      <IconPhone width={16} height={16} /> WhatsApp
    </a>
  )
}

/// Compact card for the invitations history. Shows who was invited and the
/// current status of that pre-registered visit. Tapping opens the full detail.
function InvitationCard({ visit, onOpen }) {
  const visitor = visit.visitors ?? {}
  const name = `${visitor.first_name ?? ''} ${visitor.last_name ?? ''}`.trim() || 'Invitado'
  const meta = statusMeta(visit.status)
  const av = avatarColor(name)
  const arrived = !['PRE_AUTHORIZED', 'PENDING'].includes(visit.status)
  return (
    <div className="card card-pad" style={{ ...S.card, cursor: 'pointer' }} onClick={onOpen}>
      <div style={S.cardTop}>
        <div style={{ ...S.avatar, background: av.bg, color: av.fg }}>{name[0]?.toUpperCase() ?? '?'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.name}>{name}</div>
          <div style={S.metaRow}>
            {visit.visitors?.phone && <span style={S.metaItem}><IconPhone width={13} height={13} /> {visit.visitors.phone}</span>}
            <span style={S.metaItem}><IconClock width={13} height={13} /> {_dateTime(visit.created_at)}</span>
            {visit.scheduled_end && <span style={S.metaItem}>{_validityBadge(visit.scheduled_end)}</span>}
          </div>
        </div>
        <span className="badge" style={{ background: meta.bg, color: meta.fg }}>
          {arrived ? meta.label : 'Invitada'}
        </span>
      </div>
    </div>
  )
}

function _time(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function _todayLabel() {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function _emptyMessage(tab) {
  switch (tab) {
    case 'pending': return 'No tienes visitas pendientes hoy.'
    case 'active': return 'No tienes visitas activas hoy.'
    case 'completed': return 'No hay visitas completadas hoy.'
    case 'cancelled': return 'No hay visitas canceladas o rechazadas hoy.'
    case 'invitations': return 'Aún no has generado invitaciones.'
    default: return 'Sin resultados.'
  }
}

function _dateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} · ${time}`
}

// Short "expires / expired" hint for an invitation's validity window.
function _validityBadge(scheduledEnd) {
  const end = new Date(scheduledEnd)
  const now = new Date()
  if (now > end) return '⛔ Expirada'
  const mins = Math.round((end - now) / 60000)
  if (mins < 60) return `⏳ Vence en ${mins} min`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `⏳ Vence en ${hrs} h`
  return `⏳ Vence ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
}

const S = {
  page: { maxWidth: 560, margin: '0 auto', minHeight: '100vh', background: 'var(--umbral-50, #fafafa)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 16px 12px',
  },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--slate-900)' },
  subtitle: { fontSize: 13, color: 'var(--gray-500)', textTransform: 'capitalize' },
  autoRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    margin: '0 16px 12px', padding: '10px 14px', borderRadius: 12,
    background: 'var(--white)', border: '1px solid var(--umbral-200)',
  },
  autoTitle: { fontSize: 13.5, fontWeight: 700, color: 'var(--slate-900)' },
  autoSub: { fontSize: 11.5, color: 'var(--gray-500)' },
  switch: {
    position: 'relative', width: 46, height: 26, borderRadius: 13, border: 'none',
    background: 'var(--umbral-200)', cursor: 'pointer', flexShrink: 0, padding: 0,
    transition: 'background 0.2s',
  },
  switchOn: { background: 'var(--green-600)' },
  knob: {
    position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: '50%',
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s',
  },
  knobOn: { left: 23 },
  trustChip: {
    display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700,
    padding: '1px 7px', borderRadius: 8,
  },
  trustHigh: { background: 'var(--green-100)', color: 'var(--green-600)' },
  trustLow: { background: 'var(--umbral-100)', color: 'var(--gray-500)' },
  tabs: { display: 'flex', gap: 6, padding: '0 16px 12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  tab: {
    flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid var(--umbral-200)', background: 'var(--white)',
    color: 'var(--gray-500)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  tabActive: { background: 'var(--slate-900)', color: 'var(--white)', borderColor: 'var(--slate-900)' },
  count: {
    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--umbral-100)',
    color: 'var(--gray-500)', fontSize: 11, fontWeight: 700, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
  },
  countActive: { background: 'rgba(255,255,255,0.2)', color: 'var(--white)' },
  list: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 24px' },
  card: { display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0,
  },
  name: { fontSize: 15, fontWeight: 700, color: 'var(--slate-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  metaRow: { display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gray-500)' },
  detail: {
    display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0 0',
    borderTop: '1px solid var(--umbral-100)',
  },
  detailItem: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--slate-500)' },
  waitHint: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--gray-500)',
    background: 'var(--umbral-100)', padding: '8px 12px', borderRadius: 10,
  },
  infoHint: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600,
    color: 'var(--green-600)', background: 'var(--green-100)', padding: '8px 12px', borderRadius: 10,
  },
  seeMore: {
    display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10,
    borderTop: '1px solid var(--umbral-100)', fontSize: 12.5, fontWeight: 600,
    color: 'var(--kigo-500)',
  },
  actions: { display: 'flex', gap: 8, marginTop: 2 },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,43,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24,
  },
  modalCard: {
    background: 'var(--white)', borderRadius: 18, padding: 24, maxWidth: 360, width: '100%',
    textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
  },
  iconBadge: {
    width: 52, height: 52, borderRadius: '50%', background: 'var(--kigo-500)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: 'var(--slate-900)', marginBottom: 6 },
  modalBody: { fontSize: 13.5, color: 'var(--slate-500)', lineHeight: 1.5 },
}
