import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Rental, SignatureData } from '@/types'
import { C, ACCENT, loadLogoBase64, drawHeader, drawSectionTitle, drawInfoCard, drawDetailLine, drawTotalBox, drawSignatures, drawFooter, tableStyles } from '@/utils/pdfStyles'

export const generateRemisionPDF = async (rental: Rental, remisionNumber: string, signatureData?: SignatureData) => {
  const doc = new jsPDF()
  const accent = ACCENT.blue.main

  // Header profesional
  const logoBase64 = await loadLogoBase64()
  const entregaDate = new Date(rental.start_date).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  let yPos = drawHeader(doc, accent, ACCENT.blue.dark, logoBase64, 'REMISIÓN DE ALQUILER', remisionNumber, entregaDate)

  // Información del cliente
  yPos = drawSectionTitle(doc, 'ENTREGAR A', yPos, accent)

  const clientLines = [
    `Contacto: ${rental.sale_point?.contact_name || 'N/A'}`,
    `Teléfono: ${rental.sale_point?.contact_phone || 'N/A'}`,
    `Dirección: ${rental.sale_point?.address || 'N/A'}`,
    `Ciudad: ${rental.sale_point?.city || 'N/A'}, ${rental.sale_point?.region || 'N/A'}`,
  ]
  if (rental.sale_point?.identification) clientLines.push(`NIT/CC: ${rental.sale_point.identification}`)

  const badgeText = rental.sale_point?.client_type === 'CLIENTE_EXTERNO' ? 'EXTERNO' : 'P. VENTA'
  yPos = drawInfoCard(doc, yPos, accent, rental.sale_point?.name || 'N/A', clientLines, { badge: badgeText })

  // Condiciones del alquiler
  yPos = drawSectionTitle(doc, 'CONDICIONES DEL ALQUILER', yPos, accent)
  
  const startDate = new Date(rental.start_date).toLocaleDateString('es-CO')
  const estimatedReturnDate = rental.estimated_return_date 
    ? new Date(rental.estimated_return_date).toLocaleDateString('es-CO')
    : 'No especificada'
  const estimatedDays = rental.estimated_days || 0
  
  // Tabla de condiciones compacta
  autoTable(doc, {
    startY: yPos,
    head: [['FECHA DE ENTREGA', 'FECHA ESTIMADA RETORNO', 'DÍAS ESTIMADOS']],
    body: [[startDate, estimatedReturnDate, `${estimatedDays} días`]],
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 3, textColor: [...C.dark] },
    headStyles: { fillColor: [...C.light], textColor: [...C.medium], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    bodyStyles: { fontStyle: 'bold', fontSize: 9, halign: 'center', fillColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 60 }, 2: { cellWidth: 60 } },
  })
  
  yPos = (doc as any).lastAutoTable.finalY + 5
  
  // Canastillas entregadas
  yPos = drawSectionTitle(doc, 'CANASTILLAS ENTREGADAS', yPos, accent)

  // Agrupar canastillas por tamaño, color, forma y condición
  type CanastillaGroup = { size: string; color: string; shape: string; condition: string; count: number }
  const groupedCanastillas: Record<string, CanastillaGroup> = {}

  for (const item of rental.rental_items || []) {
    const size = item.canastilla?.size || 'N/A'
    const color = item.canastilla?.color || 'N/A'
    const shape = item.canastilla?.shape || '-'
    const condition = item.canastilla?.condition || 'N/A'
    const key = `${size}-${color}-${shape}-${condition}`

    if (!groupedCanastillas[key]) {
      groupedCanastillas[key] = { size, color, shape, condition, count: 0 }
    }
    groupedCanastillas[key].count++
  }

  const canastillas = Object.values(groupedCanastillas).map((group, index) => [
    (index + 1).toString(),
    group.size,
    group.color,
    group.shape,
    group.condition,
    group.count.toString(),
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'TAMAÑO', 'COLOR', 'FORMA', 'CONDICIÓN', 'CANTIDAD']],
    body: canastillas,
    theme: 'grid',
    ...tableStyles(accent),
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 35, halign: 'center' },
      4: { cellWidth: 38, halign: 'center' },
      5: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
    },
  })
  
  yPos = (doc as any).lastAutoTable.finalY + 6
  
  // Valores del alquiler
  const canastillasCount = rental.rental_items?.length || 0
  const dailyRate = rental.daily_rate
  const estimatedTotal = estimatedDays > 0 ? canastillasCount * dailyRate * estimatedDays : 0
  
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.line(15, yPos, 195, yPos)
  yPos += 5

  drawDetailLine(doc, 'Cantidad de canastillas:', `${canastillasCount} unidades`, yPos)
  yPos += 5
  drawDetailLine(doc, 'Tarifa diaria por canastilla:', `$${dailyRate.toLocaleString('es-CO')}`, yPos)
  yPos += 5
  drawDetailLine(doc, 'Días estimados:', `${estimatedDays} días`, yPos)
  yPos += 7

  drawTotalBox(doc, 'TOTAL ESTIMADO:', `$${estimatedTotal.toLocaleString('es-CO')} COP`, yPos, accent)
  yPos += 14
  
  // Observaciones
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text('OBSERVACIONES:', 15, yPos)
  yPos += 3.5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.medium)
  doc.setFontSize(6.5)
  const observaciones = [
    '• El valor final se calculará según los días reales de uso.',
    '• Las canastillas deben devolverse en las mismas condiciones.',
    '• El cliente es responsable de cualquier daño o pérdida.',
  ]
  observaciones.forEach((obs) => { doc.text(obs, 15, yPos); yPos += 3.5 })

  // Firma - solo quien entrega (pasar yPos para evitar solapamientos)
  drawSignatures(doc, signatureData, ['ENTREGADO POR'], yPos)

  // Footer
  drawFooter(doc, accent)
  
  return doc
}

export const downloadRemisionPDF = async (rental: Rental, remisionNumber: string, signatureData?: SignatureData) => {
  const doc = await generateRemisionPDF(rental, remisionNumber, signatureData)
  const fileName = `Remision_${remisionNumber}.pdf`
  doc.save(fileName)
}

export const openRemisionPDF = async (rental: Rental, remisionNumber: string, signatureData?: SignatureData) => {
  const doc = await generateRemisionPDF(rental, remisionNumber, signatureData)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}

export const getRemisionPDFBlob = async (rental: Rental, remisionNumber: string, signatureData?: SignatureData): Promise<Blob> => {
  const doc = await generateRemisionPDF(rental, remisionNumber, signatureData)
  return doc.output('blob')
}