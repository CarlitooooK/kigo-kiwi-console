import {
  IconCalendar,
  IconUser,
  IconShield,
  IconCheckCircle,
  IconClock,
  IconCheck,
  IconX,
  IconLogout,
  IconPin,
} from '../components/icons'

const EVENT_META = {
  VISIT_CREATED: { label: 'Visita creada', color: 'var(--sky-900)', bg: 'var(--sky-50)', icon: IconCalendar },
  VISITOR_ARRIVED: { label: 'Visitante llegó', color: 'var(--sky-900)', bg: 'var(--sky-50)', icon: IconPin },
  IDENTITY_VALIDATED: { label: 'Identidad validada', color: 'var(--kigo-600)', bg: 'var(--umbral-100)', icon: IconUser },
  EVIDENCE_PROCESSED: { label: 'Evidencia procesada', color: 'var(--kigo-600)', bg: 'var(--umbral-100)', icon: IconCheckCircle },
  TRUST_EVALUATED: { label: 'Evaluación completada', color: 'var(--kigo-600)', bg: 'var(--umbral-100)', icon: IconShield },
  ACCESS_REQUESTED: { label: 'Acceso solicitado', color: '#a16207', bg: 'var(--yellow-50)', icon: IconClock },
  HOST_NOTIFIED: { label: 'Anfitrión notificado', color: '#a16207', bg: 'var(--yellow-50)', icon: IconClock },
  HOST_APPROVED: { label: 'Autorizado por anfitrión', color: 'var(--green-600)', bg: 'var(--green-100)', icon: IconCheck },
  HOST_REJECTED: { label: 'Rechazado por anfitrión', color: 'var(--red-500)', bg: 'var(--red-100)', icon: IconX },
  AUTO_AUTHORIZED: { label: 'Autorizado automáticamente', color: 'var(--green-600)', bg: 'var(--green-100)', icon: IconCheckCircle },
  CHECKED_IN: { label: 'Check-in', color: 'var(--green-600)', bg: 'var(--green-100)', icon: IconCheck },
  CHECKED_OUT: { label: 'Check-out', color: 'var(--sky-900)', bg: 'var(--sky-50)', icon: IconLogout },
  ESCALATED: { label: 'Escalado', color: '#a16207', bg: 'var(--yellow-50)', icon: IconClock },
}

export function eventMeta(eventType) {
  return (
    EVENT_META[eventType] ?? {
      label: eventType,
      color: 'var(--gray-500)',
      bg: 'var(--umbral-100)',
      icon: IconClock,
    }
  )
}
