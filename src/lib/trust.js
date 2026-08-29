export function trustColor(score) {
  if (score >= 85) return 'var(--green-600)'
  if (score >= 70) return '#a16207'
  return 'var(--red-500)'
}

export function trustLabel(score) {
  if (score >= 85) return 'Excelente'
  if (score >= 70) return 'Aceptable'
  return 'Bajo'
}
