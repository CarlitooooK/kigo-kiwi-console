import { supabase, supabaseAnon } from './supabase'

/**
 * Creates a pre-registered ("programada") visit from the web invite form.
 *
 * Mirrors the kiosk journey: a visitor + a visit are created, plus a
 * VISIT_CREATED journey event carrying the intended host. Company is simulated
 * (always Kigo), area is simulated, phone is real (WhatsApp). Email is never
 * asked/stored. The visit is marked pre-authorized so it shows up on the
 * "Tengo visita programada" flow at the kiosk.
 *
 * Returns the created visit id (used to build the badge QR).
 *
 * NOTE: ghost-visit cleanup lives server-side in Supabase (pg_cron +
 * public.expire_stale_visits(); see docs/expire_stale_visits.sql), so there is
 * no client-side sweep here.
 */
const SIM_AREAS = [
  'Piso 3 · Sala Norte', 'Piso 5 · Innovación', 'Piso 2 · Recepción Ejecutiva',
  'Piso 4 · Sala Pacífico', 'Piso 6 · Terraza', 'Piso 1 · Auditorio', 'Piso 7 · Dirección',
]

export async function createInviteVisit(organizationId, {
  firstName, lastName, phone, visitorType, detail, hostName, hostKigoUserId,
  validityMinutes,
}) {
  // 1) Visitor (company simulated = Kigo, phone real, no email).
  const { data: visitor, error: vErr } = await supabaseAnon
    .from('visitors')
    .insert({
      first_name: firstName,
      last_name: lastName,
      organization_id: organizationId,
      company: 'Kigo',
      phone: phone || null,
      visitor_type: visitorType || 'VISITOR',
    })
    .select()
    .single()
  if (vErr) throw vErr

  // 2) Visit (pre-authorized, simulated area, purpose = detail).
  const area = SIM_AREAS[Math.floor(Math.random() * SIM_AREAS.length)]
  // Validity window: usable from now until now + validityMinutes.
  const now = new Date()
  const end = new Date(now.getTime() + (validityMinutes || 1440) * 60000)
  const { data: visit, error: visitErr } = await supabaseAnon
    .from('visits')
    .insert({
      visitor_id: visitor.id,
      organization_id: organizationId,
      purpose: detail || null,
      area,
      source: 'KIGO_APP',
      is_preauthorized: true,
      status: 'PRE_AUTHORIZED',
      scheduled_start: now.toISOString(),
      scheduled_end: end.toISOString(),
    })
    .select()
    .single()
  if (visitErr) throw visitErr

  // 3) Journey event (intended host — same shape the kiosk writes).
  await supabaseAnon.from('visitor_journey_events').insert({
    visit_id: visit.id,
    event_type: 'VISIT_CREATED',
    payload: {
      source: 'WEB_INVITE',
      channel: 'WEB',
      visitor_type: visitorType || 'VISITOR',
      host_name_manual: hostName || null,
      host_kigo_user_id: hostKigoUserId ?? null,
    },
  })

  return visit.id
}

/** Start/end of "today" in local time as ISO timestamps. */
export function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { from: start, to: end }
}

/**
 * Visits for a host in the console-lite: everything created TODAY, PLUS any
 * pre-registered/scheduled visit still within its validity window
 * (scheduled_end >= now) even if created another day — so an invitation made
 * yesterday for today still appears until it expires.
 *
 * The intended host comes from the VISIT_CREATED payload (`host_kigo_user_id`).
 * When null (standalone browser) we don't filter by host.
 */
export async function getTodayVisitsForHost(organizationId, hostKigoUserId) {
  const { from, to } = todayRange()
  const nowIso = new Date().toISOString()

  let hostVisitIds = null
  if (hostKigoUserId != null) {
    const { data: events, error: evErr } = await supabase
      .from('visitor_journey_events')
      .select('visit_id, payload')
      .eq('event_type', 'VISIT_CREATED')
      .eq('payload->>host_kigo_user_id', String(hostKigoUserId))
    if (evErr) throw evErr
    hostVisitIds = [...new Set((events ?? []).map((e) => e.visit_id))]
    if (hostVisitIds.length === 0) return []
  }

  const base = () => {
    let q = supabase
      .from('visits')
      .select('*, visitors(*), trust_evaluations(score, created_at)')
      .eq('organization_id', organizationId)
    if (hostVisitIds) q = q.in('id', hostVisitIds)
    return q
  }

  // Set 1: created today. Set 2: scheduled and still valid (any creation date).
  const [todayRes, scheduledRes] = await Promise.all([
    base().gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).limit(500),
    base().eq('is_preauthorized', true).gte('scheduled_end', nowIso).limit(500),
  ])
  if (todayRes.error) throw todayRes.error
  if (scheduledRes.error) throw scheduledRes.error

  const byId = new Map()
  for (const v of [...(todayRes.data ?? []), ...(scheduledRes.data ?? [])]) {
    byId.set(v.id, v)
  }
  const visits = [...byId.values()].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )
  if (visits.length === 0) return []

  // Mark which visits already NOTIFIED the host (event HOST_NOTIFIED). Host
  // actions are only shown once this is true.
  const ids = visits.map((v) => v.id)
  const { data: notif } = await supabase
    .from('visitor_journey_events')
    .select('visit_id')
    .eq('event_type', 'HOST_NOTIFIED')
    .in('visit_id', ids)
  const notified = new Set((notif ?? []).map((e) => e.visit_id))
  return visits.map((v) => ({ ...v, hostNotified: notified.has(v.id) }))
}

/**
 * Invitations created by a host (history). These are the pre-registered visits
 * generated from the web invite form (`source = 'KIGO_APP'`), addressed to this
 * host via the VISIT_CREATED payload. Returns most recent first.
 */
export async function getInvitationsForHost(organizationId, hostKigoUserId) {
  // Resolve visit ids for invitations addressed to this host — plus any with
  // no host assigned (created from a plain browser without the Kigo bridge),
  // so demo invitations aren't lost. When there's no viewer (standalone), we
  // don't filter at all.
  let query = supabase
    .from('visitor_journey_events')
    .select('visit_id, created_at, payload')
    .eq('event_type', 'VISIT_CREATED')
    .order('created_at', { ascending: false })
    .limit(200)
  if (hostKigoUserId != null) {
    // Match this host OR invitations with no host id set.
    query = query.or(
      `payload->>host_kigo_user_id.eq.${String(hostKigoUserId)},payload->>host_kigo_user_id.is.null`
    )
  }
  const { data: events, error: evErr } = await query
  if (evErr) throw evErr
  const ids = [...new Set((events ?? []).map((e) => e.visit_id))]
  if (ids.length === 0) return []

  // Load the visits, keeping only web invitations (source KIGO_APP).
  const { data, error } = await supabase
    .from('visits')
    .select('*, visitors(*)')
    .eq('organization_id', organizationId)
    .eq('source', 'KIGO_APP')
    .in('id', ids)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

/** Gets visits for an organization (console), optionally filtered by status and/or a creation date range. */
export async function getVisitsByOrganization(organizationId, { statusFilter, from, to, limit = 500 } = {}) {
  let query = supabase
    .from('visits')
    .select('*, visitors(*), visit_evidence(type, storage_path), trust_evaluations(score, created_at)')
    .eq('organization_id', organizationId)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }
  if (from) {
    query = query.gte('created_at', from.toISOString())
  }
  if (to) {
    query = query.lt('created_at', to.toISOString())
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data ?? []
}

/** Gets a single visit with all related data. Fetches host separately to avoid null FK join issues. */
export async function getVisitDetail(visitId) {
  const { data, error } = await supabase
    .from('visits')
    .select(
      `*,
      visitors(*),
      visit_evidence(*),
      trust_evaluations(*),
      access_decisions(*),
      visitor_journey_events(*)`
    )
    .eq('id', visitId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  if (data.host_id) {
    const { data: host } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', data.host_id)
      .maybeSingle()
    data.profiles = host
  }

  return data
}
