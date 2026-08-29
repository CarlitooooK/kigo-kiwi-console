import { supabase, ORGANIZATION_ID } from './supabase'
import { latestTrustScore } from './visitMeta'
import { getJourney } from './journeyRepository'

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function minutesBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000
}

function average(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/** Dashboard stats + averages (trust score, visit duration, wait time) + a 7-day trend. */
export async function getDashboardMetrics() {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)

  const [{ data: todayVisits, error: todayError }, { data: weekVisits, error: weekError }] = await Promise.all([
    supabase
      .from('visits')
      .select('status, created_at, checked_in_at, checked_out_at, trust_evaluations(score)')
      .eq('organization_id', ORGANIZATION_ID)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', todayEnd.toISOString()),
    supabase
      .from('visits')
      .select('created_at')
      .eq('organization_id', ORGANIZATION_ID)
      .gte('created_at', weekStart.toISOString())
      .lt('created_at', todayEnd.toISOString()),
  ])

  if (todayError) throw todayError
  if (weekError) throw weekError

  const visits = todayVisits ?? []
  const counts = { totalToday: visits.length, active: 0, pending: 0, completed: 0, rejected: 0 }
  const trustScores = []
  const durations = []
  const waits = []

  for (const visit of visits) {
    switch (visit.status) {
      case 'ACTIVE':
      case 'CHECKED_IN':
        counts.active++
        break
      case 'PENDING':
      case 'PRE_AUTHORIZED':
      case 'IN_PROGRESS':
        counts.pending++
        break
      case 'COMPLETED':
        counts.completed++
        break
      case 'REJECTED':
      case 'CANCELLED':
        counts.rejected++
        break
      default:
        break
    }

    const score = latestTrustScore(visit)
    if (score != null) trustScores.push(score)

    if (visit.checked_in_at && visit.checked_out_at) {
      durations.push(minutesBetween(visit.checked_in_at, visit.checked_out_at))
    }
    if (visit.checked_in_at) {
      waits.push(minutesBetween(visit.created_at, visit.checked_in_at))
    }
  }

  const trustBuckets = { excellent: 0, acceptable: 0, low: 0 }
  for (const score of trustScores) {
    if (score >= 85) trustBuckets.excellent++
    else if (score >= 70) trustBuckets.acceptable++
    else trustBuckets.low++
  }

  const dayBuckets = new Map()
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    dayBuckets.set(d.toDateString(), { date: d, count: 0 })
  }
  for (const visit of weekVisits ?? []) {
    const bucket = dayBuckets.get(new Date(visit.created_at).toDateString())
    if (bucket) bucket.count++
  }
  const visitsByDay = Array.from(dayBuckets.values()).map((b) => ({
    label: b.date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''),
    value: b.count,
  }))

  return {
    ...counts,
    avgTrustScore: average(trustScores),
    trustEvaluatedCount: trustScores.length,
    trustBuckets,
    avgVisitDurationMinutes: average(durations),
    avgWaitMinutes: average(waits),
    visitsByDay,
  }
}

export function formatMinutes(mins) {
  if (mins == null) return '—'
  const total = Math.round(mins)
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Most recent visits (any status) together with their full journey, for an at-a-glance recap. */
export async function getRecentVisitsWithJourney(limit = 2) {
  const { data, error } = await supabase
    .from('visits')
    .select('id, status, created_at, visitors(first_name, last_name)')
    .eq('organization_id', ORGANIZATION_ID)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const visits = data ?? []
  return Promise.all(
    visits.map(async (visit) => ({
      visit,
      events: await getJourney(visit.id).catch(() => []),
    }))
  )
}
