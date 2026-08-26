const STATUS_META = {
  ACTIVE: { label: 'Activa', bg: 'var(--green-100)', fg: 'var(--green-600)' },
  CHECKED_IN: { label: 'Check-in', bg: 'var(--green-100)', fg: 'var(--green-600)' },
  PENDING: { label: 'Pendiente', bg: 'var(--sky-50)', fg: 'var(--sky-900)' },
  PRE_AUTHORIZED: { label: 'Pre-autorizada', bg: 'var(--sky-50)', fg: 'var(--sky-900)' },
  IN_PROGRESS: { label: 'En proceso', bg: 'var(--yellow-50)', fg: '#a16207' },
  COMPLETED: { label: 'Completada', bg: 'var(--umbral-100)', fg: 'var(--slate-500)' },
  REJECTED: { label: 'Rechazada', bg: 'var(--red-100)', fg: 'var(--red-500)' },
  CANCELLED: { label: 'Cancelada', bg: 'var(--red-100)', fg: 'var(--red-500)' },
}

export function statusMeta(status) {
  return STATUS_META[status] ?? { label: status, bg: 'var(--umbral-100)', fg: 'var(--slate-500)' }
}

const AVATAR_PALETTE = [
  { bg: '#ffe4d1', fg: 'var(--kigo-600)' },
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#dcfce7', fg: 'var(--green-600)' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#fef9c3', fg: '#a16207' },
]

export function avatarColor(seed) {
  const code = (seed ?? '').charCodeAt(0) || 0
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]
}

export const VISIT_FILTERS = [
  { key: 'all', label: 'Todas', status: null },
  { key: 'active', label: 'Activas', status: 'ACTIVE' },
  { key: 'pending', label: 'Pendientes', status: 'IN_PROGRESS' },
  { key: 'completed', label: 'Completadas', status: 'COMPLETED' },
  { key: 'rejected', label: 'Rechazadas', status: 'REJECTED' },
]
