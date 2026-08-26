/** Statuses where a photo preview in the list is actually useful to make a decision. */
export const ACTIONABLE_STATUSES = ['ACTIVE', 'CHECKED_IN', 'PENDING', 'PRE_AUTHORIZED', 'IN_PROGRESS']

export function latestTrustScore(visit) {
  const evals = visit.trust_evaluations ?? []
  if (evals.length === 0) return null
  return Number(evals[evals.length - 1].score)
}

/** Picks the most identity-relevant evidence item to preview: selfie first, then ID front. */
export function primaryEvidence(visit) {
  const evidence = visit.visit_evidence ?? []
  return (
    evidence.find((e) => e.type === 'SELFIE') ??
    evidence.find((e) => e.type === 'ID_FRONT') ??
    evidence[0] ??
    null
  )
}

export function evidenceBucket(type) {
  return type === 'SELFIE' ? 'visitor-photos' : 'visit-evidence'
}

export function evidenceTypeLabel(type) {
  switch (type) {
    case 'ID_FRONT':
      return 'Identificación (frente)'
    case 'ID_BACK':
      return 'Identificación (reverso)'
    case 'SELFIE':
      return 'Fotografía'
    default:
      return type
  }
}
