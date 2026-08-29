import { statusMeta } from './status'
import { latestTrustScore } from './visitMeta'

// Loaded on demand — jsPDF (+ its optional html2canvas dependency) is heavy and
// only needed the moment someone actually exports a report.
export async function exportVisitsPdf({ visits, periodLabel, statusLabel }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ orientation: 'landscape' })
  const generatedAt = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

  doc.setFontSize(16)
  doc.setTextColor(15, 23, 43)
  doc.text('Kigo Welcome · Reporte de visitas', 14, 18)

  doc.setFontSize(10)
  doc.setTextColor(98, 116, 142)
  doc.text(`Periodo: ${periodLabel}   ·   Estado: ${statusLabel}   ·   Generado: ${generatedAt}`, 14, 25)
  doc.text(`Total de registros: ${visits.length}`, 14, 30)

  autoTable(doc, {
    startY: 36,
    head: [['Visitante', 'Empresa', 'Anfitrión', 'Trust Score', 'Fecha', 'Hora', 'Estado']],
    body: visits.map((v) => {
      const visitor = v.visitors ?? {}
      const host = v.profiles ?? {}
      const score = latestTrustScore(v)
      const date = new Date(v.created_at)
      return [
        `${visitor.first_name ?? ''} ${visitor.last_name ?? ''}`.trim() || '—',
        visitor.company || '—',
        host.full_name || '—',
        score != null ? String(Math.round(score)) : '—',
        date.toLocaleDateString('es-MX'),
        date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }),
        statusMeta(v.status).label,
      ]
    }),
    headStyles: { fillColor: [255, 105, 0], textColor: 255 },
    styles: { fontSize: 9, textColor: [15, 23, 43] },
    alternateRowStyles: { fillColor: [246, 238, 237] },
  })

  doc.save(`kigo-visitas-${new Date().toISOString().slice(0, 10)}.pdf`)
}
