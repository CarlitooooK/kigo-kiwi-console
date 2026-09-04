import { supabase } from './supabase'
import { logEvent } from './journeyRepository'

/// Shared host actions, used by both the single-visit authorize mini-app and
/// the host console-lite list. Keeping them here avoids duplicating the
/// Supabase writes and the journey logging.

/** Approves a pending visit → ACTIVE + checked in. */
export async function approveVisit(visitId) {
  await supabase.from('access_decisions').insert({
    visit_id: visitId, decision: 'GRANTED', decided_by: 'HOST',
    reason: 'Authorized from Kigo mini-app',
  })
  await supabase
    .from('visits')
    .update({ status: 'ACTIVE', checked_in_at: new Date().toISOString() })
    .eq('id', visitId)
  await logEvent({ visitId, eventType: 'HOST_APPROVED', payload: { from: 'kigo_miniapp' } })
  await logEvent({ visitId, eventType: 'CHECKED_IN' })
}

/** Rejects a pending visit. */
export async function rejectVisit(visitId) {
  await supabase.from('access_decisions').insert({
    visit_id: visitId, decision: 'DENIED', decided_by: 'HOST',
    reason: 'Rejected from Kigo mini-app',
  })
  await supabase.from('visits').update({ status: 'REJECTED' }).eq('id', visitId)
  await logEvent({ visitId, eventType: 'HOST_REJECTED', payload: { from: 'kigo_miniapp' } })
}

/** Checks out an active visit → COMPLETED. */
export async function checkOutVisit(visitId) {
  await supabase
    .from('visits')
    .update({ status: 'COMPLETED', checked_out_at: new Date().toISOString() })
    .eq('id', visitId)
  await logEvent({ visitId, eventType: 'CHECKED_OUT', payload: { from: 'kigo_miniapp' } })
}

/** Whether a visitor has a face enrollment (i.e. can be marked recurrent). */
export async function hasFaceEnrollment(visitorId) {
  if (!visitorId) return false
  const { data } = await supabase
    .from('face_enrollments')
    .select('id, is_recurrent')
    .eq('visitor_id', visitorId)
    .maybeSingle()
  return data ? { id: data.id, isRecurrent: data.is_recurrent } : false
}

/** Marks a visitor's enrollment as recurrent (host decision after checkout). */
export async function markRecurrent(visitorId, recurrent = true) {
  await supabase
    .from('face_enrollments')
    .update({ is_recurrent: recurrent })
    .eq('visitor_id', visitorId)
}

/** Removes a visitor's face enrollment entirely (un-enroll). */
export async function unenrollFace(visitorId) {
  if (!visitorId) return
  await supabase.from('face_enrollments').delete().eq('visitor_id', visitorId)
}

/**
 * Builds a wa.me link with an approval message + the visit-follow QR link.
 * Normalizes the phone to digits, assuming Mexico (+52) for 10-digit locals.
 */
export function whatsappLink(visit, visitId) {
  const visitor = visit?.visitors ?? {}
  let digits = (visitor.phone ?? '').replace(/\D/g, '')
  if (digits.length === 10) digits = `52${digits}`

  const name = (visitor.first_name ?? '').trim()
  const company = (visitor.company ?? '').trim()
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
