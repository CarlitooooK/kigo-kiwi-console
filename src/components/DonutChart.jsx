export default function DonutChart({ segments, size = 120, thickness = 16 }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--umbral-100)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            if (s.value === 0) return null
            const dash = (s.value / total) * circumference
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-cumulative}
              />
            )
            cumulative += dash
            return el
          })}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 140 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--slate-900)', fontWeight: 500 }}>{s.label}</span>
            <span style={{ color: 'var(--gray-500)', marginLeft: 'auto', paddingLeft: 12, fontWeight: 500 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
