import { statusMeta } from '../lib/status'

export default function StatusBadge({ status }) {
  const { label, bg, fg } = statusMeta(status)
  return (
    <span className="badge" style={{ background: bg, color: fg }}>
      <span className="badge-dot" />
      {label}
    </span>
  )
}
