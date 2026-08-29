export default function BarChart({ data, height = 160, color = 'var(--kigo-500)' }) {
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height }}>
      {data.map((d, i) => {
        const barHeight = d.value === 0 ? 2 : Math.max(4, (d.value / max) * (height - 38))
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 6,
              height: '100%',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--slate-900)' }}>{d.value}</span>
            <div
              title={`${d.label}: ${d.value}`}
              style={{
                width: '100%',
                maxWidth: 30,
                height: barHeight,
                borderRadius: 6,
                background: d.value === 0 ? 'var(--umbral-200)' : color,
                transition: 'height 0.3s var(--ease)',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 500, textTransform: 'capitalize' }}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
