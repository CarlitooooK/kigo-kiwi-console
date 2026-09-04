import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { createInviteVisit } from '../lib/visitRepository'
import { ORGANIZATION_ID } from '../lib/supabase'
import { bridgeAuthUserId } from '../lib/kigoBridge'
import { IconArrowLeft, IconCheck, IconDownload, IconUser, IconPhone, IconTag, IconClock } from '../components/icons'

// Visit types match the kiosk (AppConstants).
const TYPES = [
  { value: 'CLIENT', label: 'Cliente / Reunión' },
  { value: 'PROVIDER', label: 'Proveedor' },
  { value: 'INTERVIEW', label: 'Entrevista' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'DELIVERY', label: 'Entrega' },
  { value: 'VISITOR', label: 'Visita personal' },
]

// Per-type label for the free-text detail, mirroring the kiosk.
function detailLabel(type) {
  switch (type) {
    case 'CLIENT': return 'Asunto de la reunión'
    case 'PROVIDER': return 'Servicio a realizar'
    case 'MAINTENANCE': return 'Trabajo a realizar'
    case 'INTERVIEW': return 'Posición a la que aplica'
    default: return 'Motivo de visita'
  }
}

// Validity options for the invitation QR (single-use within this window).
const VALIDITY = [
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 180, label: '3 horas' },
  { value: 480, label: '8 horas' },
  { value: 1440, label: '1 día' },
  { value: 4320, label: '3 días' },
  { value: 10080, label: '1 semana' },
]

/// Web invite form (pre-registration). Captures the same data as the kiosk,
/// creates a pre-authorized visit in Supabase, and generates a downloadable QR
/// the visitor presents at the F10 ("Tengo visita programada").
///
/// Works standalone (link shared by the host) and embedded in the Kigo app
/// (opened from the host console-lite), where the host identity comes from the
/// bridge.
export default function InviteForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', visitorType: 'CLIENT',
    detail: '', hostName: '', validityMinutes: 1440,
  })
  const [hostId, setHostId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null) // { visitId, qrDataUrl }

  useEffect(() => {
    // When embedded in Kigo, capture the host identity for the invite.
    bridgeAuthUserId().then((id) => setHostId(id)).catch(() => setHostId(null))
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Sanitized setter: strips disallowed characters as the user types.
  // - name: letters (incl. accents/ñ) and spaces only — no hyphen/apostrophe
  // - phone: digits only
  // - freeText: letters, digits and spaces only — no special characters
  const sanitizers = {
    name: (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ ]/g, '').slice(0, 50),
    phone: (v) => v.replace(/\D/g, '').slice(0, 15),
    freeText: (v) => v.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ ]/g, '').slice(0, 120),
  }
  const setClean = (k, kind) => (e) => {
    const clean = sanitizers[kind](e.target.value)
    setForm((f) => ({ ...f, [k]: clean }))
  }

  const phoneValid = useMemo(() => {
    const d = form.phone.replace(/\D/g, '')
    return d.length >= 10 && d.length <= 15
  }, [form.phone])

  const canSubmit = form.firstName.trim() && form.hostName.trim() && phoneValid && !submitting

  async function onSubmit(e) {
    e.preventDefault()
    if (!canSubmit) {
      if (!phoneValid) setError('Ingresa un celular válido (10 dígitos).')
      else setError('Completa nombre, celular y a quién visitas.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const visitId = await createInviteVisit(ORGANIZATION_ID, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.replace(/\D/g, ''),
        visitorType: form.visitorType,
        detail: form.detail.trim(),
        hostName: form.hostName.trim(),
        hostKigoUserId: hostId,
        validityMinutes: Number(form.validityMinutes),
      })
      // Badge QR: same universal-link format the kiosk badge uses.
      const payload = `https://parkimovil.com/app?qr=WELCOME:${visitId}`
      const qrDataUrl = await QRCode.toDataURL(payload, {
        width: 640, margin: 2, color: { dark: '#0f172b', light: '#ffffff' },
      })
      setDone({ visitId, qrDataUrl })
    } catch (err) {
      setError(`No se pudo crear la invitación. (${err.message})`)
    } finally {
      setSubmitting(false)
    }
  }

  function downloadQr() {
    if (!done) return
    // In a plain browser this downloads. Inside the Kigo WebView, <a download>
    // may be ignored, so we also open the image in a new tab as a fallback and
    // tell the user they can long-press to save.
    try {
      const a = document.createElement('a')
      a.href = done.qrDataUrl
      a.download = `invitacion-kigo-${done.visitId}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch { /* ignore */ }
    try {
      const w = window.open()
      if (w) {
        w.document.write(
          `<img src="${done.qrDataUrl}" style="width:100%;max-width:420px;display:block;margin:24px auto"/>`
        )
        w.document.title = 'QR de invitación'
      }
    } catch { /* ignore */ }
  }

  if (done) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={22} height={22} style={{ borderRadius: 5, verticalAlign: "middle", marginRight: 6 }} /><span style={S.brand}>Kigo Welcome</span>
        </div>
        <div style={S.iconOk}><IconCheck size={26} /></div>
        <h1 style={S.title}>Invitación lista</h1>
        <p style={S.subtitle}>
          {form.firstName} presenta este QR en el kiosko, opción “Tengo visita programada”.
        </p>
        <p style={{ textAlign: 'center', color: 'var(--kigo-500)', fontSize: 13, fontWeight: 600, margin: '6px 0 0' }}>
          Válido {_validityText(form.validityMinutes)} · hasta {_expiryText(form.validityMinutes)}
        </p>
        <div style={S.qrCard}>
          <img src={done.qrDataUrl} alt="QR de invitación" style={{ width: '100%', maxWidth: 280, borderRadius: 12 }} />
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={downloadQr}>
          <IconDownload size={16} /> Descargar QR
        </button>
        <p style={{ textAlign: 'center', color: 'var(--gray-500)', fontSize: 12, margin: '8px 0 0' }}>
          En el celular, también puedes mantener presionada la imagen para guardarla.
        </p>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }}
          onClick={() => { setDone(null); setForm((f) => ({ ...f, firstName: '', lastName: '', phone: '', detail: '' })) }}>
          Crear otra invitación
        </button>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ padding: '4px 8px', marginBottom: 4 }}>
        <IconArrowLeft size={16} /> Atrás
      </button>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={22} height={22} style={{ borderRadius: 5, verticalAlign: "middle", marginRight: 6 }} /><span style={S.brand}>Kigo Welcome</span>
      </div>
      <h1 style={S.title}>Invitar visita</h1>
      <p style={S.subtitle}>Genera un QR de acceso para tu invitado.</p>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
        <Field icon={IconTag} label="Tipo de visita">
          <select value={form.visitorType} onChange={set('visitorType')} style={S.input}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>

        <Field icon={IconUser} label="Nombre(s)">
          <input value={form.firstName} onChange={setClean('firstName', 'name')} style={S.input} placeholder="Nombre del invitado" />
        </Field>
        <Field icon={IconUser} label="Apellidos">
          <input value={form.lastName} onChange={setClean('lastName', 'name')} style={S.input} placeholder="Apellidos" />
        </Field>

        <Field icon={IconPhone} label="Celular">
          <input value={form.phone} onChange={setClean('phone', 'phone')} style={S.input} inputMode="tel" placeholder="10 dígitos" />
        </Field>

        <Field icon={IconUser} label="¿A quién visita? (anfitrión)">
          <input value={form.hostName} onChange={setClean('hostName', 'name')} style={S.input} placeholder="Nombre del anfitrión" />
        </Field>

        <Field icon={IconTag} label={detailLabel(form.visitorType)}>
          <input value={form.detail} onChange={setClean('detail', 'freeText')} style={S.input} placeholder="Opcional" />
        </Field>

        <Field icon={IconClock} label="Vigencia del acceso">
          <select value={form.validityMinutes} onChange={set('validityMinutes')} style={S.input}>
            {VALIDITY.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </Field>

        {error && <div style={S.error}>{error}</div>}

        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4 }} disabled={!canSubmit}>
          {submitting ? 'Generando…' : 'Generar invitación'}
        </button>
      </form>
    </div>
  )
}

function Field({ icon: Icon, label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={S.fieldLabel}><Icon size={13} /> {label}</div>
      {children}
    </label>
  )
}

function _validityText(minutes) {
  const v = VALIDITY.find((x) => x.value === Number(minutes))
  return v ? v.label : `${minutes} min`
}

function _expiryText(minutes) {
  const d = new Date(Date.now() + Number(minutes) * 60000)
  const sameDay = d.toDateString() === new Date().toDateString()
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (sameDay) return time
  const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  return `${date} ${time}`
}

const S = {
  page: { maxWidth: 460, margin: '0 auto', padding: 20, minHeight: '100vh' },
  brand: { fontSize: 13, fontWeight: 600, color: 'var(--kigo-500)' },
  title: { fontSize: 22, fontWeight: 700, color: 'var(--slate-900)', textAlign: 'center', margin: '0 0 4px' },
  subtitle: { textAlign: 'center', color: 'var(--slate-500)', fontSize: 14, margin: 0 },
  fieldLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 },
  input: {
    width: '100%', height: 44, padding: '0 12px', borderRadius: 10,
    border: '1px solid var(--umbral-200)', fontSize: 15, background: 'var(--white)',
    color: 'var(--slate-900)', boxSizing: 'border-box',
  },
  error: { fontSize: 13, color: 'var(--red-500)', background: 'var(--red-100)', padding: '8px 12px', borderRadius: 10 },
  iconOk: {
    width: 60, height: 60, borderRadius: '50%', background: 'var(--green-100)', color: 'var(--green-600)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px auto 12px',
  },
  qrCard: {
    background: 'var(--white)', border: '1px solid var(--umbral-200)', borderRadius: 16,
    padding: 20, display: 'flex', justifyContent: 'center', margin: '12px 0 16px',
  },
}
