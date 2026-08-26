export default function KigoLoader({ message }) {
  return (
    <div className="loader">
      <div className="spinner" />
      {message && <span>{message}</span>}
    </div>
  )
}
