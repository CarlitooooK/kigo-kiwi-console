import { trustColor } from '../lib/trust'

export default function TrustRing({ score, size = 64, fontSize }) {
  const color = trustColor(score)
  const inner = Math.round(size * 0.74)
  const fs = fontSize ?? Math.round(size * 0.27)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: `conic-gradient(${color} ${score * 3.6}deg, var(--umbral-200) 0deg)`,
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: 'var(--white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: fs,
          color: 'var(--slate-900)',
        }}
      >
        {Math.round(score)}
      </div>
    </div>
  )
}
