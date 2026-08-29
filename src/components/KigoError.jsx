import { IconAlertCircle } from './icons'

export default function KigoError({ message, onRetry }) {
  return (
    <div className="state-block">
      <div className="state-icon-wrap" style={{ background: 'var(--red-100)', color: 'var(--red-500)' }}>
        <IconAlertCircle size={24} />
      </div>
      <p className="state-title" style={{ fontWeight: 500 }}>
        {message}
      </p>
      {onRetry && (
        <button className="btn btn-outline" style={{ marginTop: 14 }} onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
