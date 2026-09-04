import { eventMeta } from '../lib/journeyEvents'

function formatTime(iso) {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function JourneyTimeline({ events }) {
  if (!events || events.length === 0) {
    return <p style={{ color: 'var(--gray-500)', fontSize: 13.5, margin: 0 }}>Sin eventos registrados</p>
  }

  return (
    <div>
      {events.map((event, index) => {
        const isLast = index === events.length - 1
        const meta = eventMeta(event.event_type, event.payload)
        const Icon = meta.icon

        return (
          <div key={event.id ?? index} style={{ display: 'flex', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: meta.bg,
                  color: meta.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={15} />
              </div>
              {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--umbral-200)', margin: '2px 0' }} />}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : 22, paddingTop: 5, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: isLast ? 600 : 500, color: 'var(--slate-900)' }}>
                {meta.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 1 }}>{formatTime(event.created_at)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
