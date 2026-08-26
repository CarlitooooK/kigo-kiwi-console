function formatShort(d) {
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export const PERIOD_FILTERS = [
  { key: 'all', label: 'Todo' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
]

/** Returns { start, end, label } for a period key (end is exclusive), or null for 'all'. */
export function getPeriodRange(key) {
  const now = new Date()

  if (key === 'week') {
    const diffToMonday = (now.getDay() + 6) % 7
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const lastDay = new Date(end)
    lastDay.setDate(lastDay.getDate() - 1)
    return { start, end, label: `Semana del ${formatShort(start)} al ${formatShort(lastDay)}` }
  }

  if (key === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const label = start.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return { start, end, label: label.charAt(0).toUpperCase() + label.slice(1) }
  }

  return null
}
