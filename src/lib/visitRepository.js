import { supabase } from './supabase'

/** Gets visits for an organization (console), optionally filtered by status. */
export async function getVisitsByOrganization(organizationId, { statusFilter, limit = 100 } = {}) {
  let query = supabase
    .from('visits')
    .select('*, visitors(*), visit_evidence(type, storage_path), trust_evaluations(score, created_at)')
    .eq('organization_id', organizationId)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
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
