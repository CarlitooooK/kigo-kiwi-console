import { useEffect, useMemo, useState } from 'react'
import { createEnrollment, getEnrollment, getPhoto } from '../lib/kigoRepository'
import { supabase } from '../lib/supabase'

const QR_CODE_URL = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='

export default function KigoEnrollment({ visitorId, visitId, visitor, visit }) {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState('IDLE')
  const [error, setError] = useState('')
  const [enrollment, setEnrollment] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [selfieRecordId, setSelfieRecordId] = useState(null)

  const existingSelfie = useMemo(() => {
    return (visit?.visit_evidence ?? []).find((entry) => entry.type === 'SELFIE') ?? null
  }, [visit])

  useEffect(() => {
    if (!existingSelfie) return

    const nextStatus = existingSelfie.metadata?.kigo_status || 'COMPLETED'
    const nextEnrollment = {
      enrollment_id: existingSelfie.metadata?.enrollment_id || null,
      enrollment_url: existingSelfie.metadata?.enrollment_url || '',
      status: nextStatus,
    }

    setEnrollment(nextEnrollment)
    setStatus(nextStatus)
    setSelfieRecordId(existingSelfie.id)

    const storagePath = existingSelfie.storage_path
    if (!storagePath) return

    let cancelled = false

    supabase.storage
      .from('visitor-photos')
      .createSignedUrl(storagePath, 3600)
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.signedUrl) {
          setPhotoUrl(data.signedUrl)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [existingSelfie])

  const metadata = useMemo(() => {
    return {
      visitor_id: visitorId,
      visit_id: visitId,
      nombre: [visitor?.first_name, visitor?.last_name].filter(Boolean).join(' ') || 'Visitante',
      email: visitor?.email ?? '',
      phone: visitor?.phone ?? '',
      empresa: visitor?.company ?? '',
      area: visit?.area ?? '',
      purpose: visit?.purpose ?? '',
    }
  }, [visitor, visit, visitorId, visitId])

  async function handleCreateEnrollment() {
    if (existingSelfie) {
      setStatus(existingSelfie.metadata?.kigo_status || 'COMPLETED')
      setError('')
      return
    }

    setLoading(true)
    setError('')
    setStatus('CREATING')

    try {
      const result = await createEnrollment(String(visitorId ?? visitId ?? 'unknown-visitor'), metadata)
      setEnrollment(result)
      setStatus(result?.status || 'PENDING')
      setSelfieRecordId(null)
    } catch (e) {
      setError(e.message)
      setStatus('ERROR')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyEnrollment() {
    if (!enrollment?.enrollment_id) return

    setChecking(true)
    setError('')

    try {
      const result = await getEnrollment(enrollment.enrollment_id)
      setStatus(result?.status || 'UNKNOWN')

      if (result?.status === 'COMPLETED') {
        const blob = await getPhoto(enrollment.enrollment_id)
        const fileName = `kigo-selfie-${visitId || visitorId}.jpg`
        const storagePath = `${visitId || visitorId}/${fileName}`
        const arrayBuffer = await blob.arrayBuffer()
        const file = new File([arrayBuffer], fileName, { type: 'image/jpeg' })

        const { error: uploadError } = await supabase.storage.from('visitor-photos').upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/jpeg',
        })

        if (uploadError) {
          throw uploadError
        }

        const payload = {
          visit_id: visitId,
          type: 'SELFIE',
          storage_path: storagePath,
          metadata: {
            source: 'KIGO',
            enrollment_id: enrollment.enrollment_id,
            enrollment_url: enrollment.enrollment_url || '',
            kigo_status: result.status,
          },
          created_at: new Date().toISOString(),
        }

        if (selfieRecordId) {
          const { error: updateError } = await supabase.from('visit_evidence').update(payload).eq('id', selfieRecordId)
          if (updateError) throw updateError
        } else {
          const { error: insertError } = await supabase.from('visit_evidence').insert(payload)
          if (insertError) throw insertError
        }

        const { data: signedUrlData } = await supabase.storage.from('visitor-photos').createSignedUrl(storagePath, 3600)
        setPhotoUrl(signedUrlData?.signedUrl || '')
        setStatus(result.status)
      }
    } catch (e) {
      setError(e.message || 'No se pudo verificar el enrolamiento')
    } finally {
      setChecking(false)
    }
  }

  async function handleRevokePermission() {
    const target = existingSelfie ?? (visit?.visit_evidence ?? []).find((entry) => entry.type === 'SELFIE')
    if (!target) {
      setEnrollment(null)
      setStatus('IDLE')
      setPhotoUrl('')
      return
    }

    try {
      if (target.storage_path) {
        const { error: deleteStorageError } = await supabase.storage.from('visitor-photos').remove([target.storage_path])
        if (deleteStorageError) throw deleteStorageError
      }

      const { error: deleteRowError } = await supabase.from('visit_evidence').delete().eq('id', target.id)
      if (deleteRowError) throw deleteRowError

      setEnrollment(null)
      setPhotoUrl('')
      setSelfieRecordId(null)
      setStatus('IDLE')
      setError('')
    } catch (e) {
      setError(e.message || 'No se pudo quitar el permiso')
    }
  }

  const qrUrl = enrollment?.enrollment_url ? encodeURIComponent(enrollment.enrollment_url) : ''

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--slate-900)', margin: '0 0 12px' }}>Enrolamiento facial</h3>

      {!enrollment || (enrollment?.status && !photoUrl && !existingSelfie) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: 0 }}>
            Genera un enlace para que el visitante complete el reconocimiento facial.
          </p>
          <button className="btn btn-primary" onClick={handleCreateEnrollment} disabled={loading}>
            {loading ? 'Creando…' : 'Enrolar rostro'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {enrollment.enrollment_url && (
              <img
                src={`${QR_CODE_URL}${qrUrl}`}
                alt="QR de enrolamiento"
                style={{ width: 140, height: 140, borderRadius: 12, border: '1px solid var(--umbral-200)', background: '#fff' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 6 }}>Estado</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{status}</div>
              {enrollment.enrollment_id && (
                <>
                  <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginTop: 8 }}>ID</div>
                  <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{enrollment.enrollment_id || '—'}</div>
                </>
              )}
            </div>
          </div>

          {enrollment.enrollment_url && (
            <a href={enrollment.enrollment_url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ width: '100%', textAlign: 'center' }}>
              Abrir enlace de enrolamiento
            </a>
          )}

          {!photoUrl && (
            <button className="btn btn-outline" onClick={handleVerifyEnrollment} disabled={checking}>
              {checking ? 'Verificando…' : 'Verificar proceso'}
            </button>
          )}

          {photoUrl && (
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--gray-500)', marginBottom: 8 }}>Foto registrada</div>
              <img src={photoUrl} alt="Selfie registrada" style={{ width: '100%', maxWidth: 220, borderRadius: 10 }} />
            </div>
          )}

          {existingSelfie && (
            <button className="btn btn-outline-danger" onClick={handleRevokePermission}>
              Quitar permiso
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, color: 'var(--red-500)', fontSize: 12, lineHeight: 1.5 }}>{error}</div>
      )}
    </div>
  )
}
