import { supabase } from './supabase'

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
