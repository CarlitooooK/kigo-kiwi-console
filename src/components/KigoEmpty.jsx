import { IconInbox } from './icons'

export default function KigoEmpty({ title, subtitle, icon: Icon = IconInbox }) {
  return (
    <div className="state-block">
      <div className="state-icon-wrap" style={{ background: 'var(--umbral-100)', color: 'var(--slate-500)' }}>
        <Icon size={24} />
      </div>
      <p className="state-title">{title}</p>
      {subtitle && <p className="state-subtitle">{subtitle}</p>}
    </div>
  )
}
