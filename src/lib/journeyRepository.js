import { supabase } from './supabase'

/** Logs a visitor journey event. */
export async function logEvent({ visitId, eventType, payload = {} }) {
  const { error } = await supabase.from('visitor_journey_events').insert({
    visit_id: visitId,
    event_type: eventType,
    payload,
  })
  if (error) throw error
}

/** Gets all journey events for a visit, ordered by time. */
export async function getJourney(visitId) {
  const { data, error } = await supabase
    .from('visitor_journey_events')
    .select()
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
