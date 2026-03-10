import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Rental, RentalReturn, Canastilla, SignatureData } from '@/types'
import { C, ACCENT, loadLogoBase64, drawHeader, drawSectionTitle, drawInfoCard, drawDetailLine, drawTotalBox, drawSignatures, drawFooter, tableStyles } from '@/utils/pdfStyles'

interface FacturaData {
  rental: Rental
  returnData: {
    invoiceNumber: string
    returnDate: string
    daysCharged: number
    amount: number
    notes?: string
    canastillas: Canastilla[]
  }
  isPartial: boolean
  pendingCount: number
}

export const generateFacturaDevolucionPDF = async (data: FacturaData, signatureData?: SignatureData) => {
  const doc = new jsPDF()
  const { rental, returnData, isPartial, pendingCount } = data

  const accent = ACCENT.green.main
  const accentDark = ACCENT.green.dark
  const pageHeight = doc.internal.pageSize.height

  // Header profesional
  const logoBase64 = await loadLogoBase64()
  const tipoDoc = isPartial ? 'FACTURA PARCIAL' : 'FACTURA DEVOLUCIÓN'
  const fechaFactura = new Date(returnData.returnDate).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  let yPos = drawHeader(doc, accent, accentDark, logoBase64, tipoDoc, returnData.invoiceNumber, fechaFactura)

  // Información del cliente
  yPos = drawSectionTitle(doc, 'FACTURAR A', yPos, accent, 45)
  const badgeText = rental.sale_point?.client_type === 'CLIENTE_EXTERNO' ? 'EXTERNO' : 'P. VENTA'
  const clientLines = [
    `Contacto: ${rental.sale_point?.contact_name || 'N/A'}`,
    `Teléfono: ${rental.sale_point?.contact_phone || 'N/A'}`,
    `Dirección: ${rental.sale_point?.address || 'N/A'}`,
    ...(rental.sale_point?.identification ? [`NIT/CC: ${rental.sale_point.identification}`] : []),
  ]
  yPos = drawInfoCard(doc, yPos, accent, rental.sale_point?.name || 'N/A', clientLines, { badge: badgeText })

  // Referencia del alquiler original
  const refLines = [
    `Remisión: ${rental.remision_number || 'N/A'}`,
    `Fecha inicio: ${new Date(rental.start_date).toLocaleDateString('es-CO')}`,
    `Tipo: ${rental.rental_type}`,
    ...(isPartial ? [`⚠ Pendientes: ${pendingCount} canastillas`] : []),
  ]
  yPos = drawInfoCard(doc, yPos, accent, 'REFERENCIA ALQUILER', refLines)

  // Canastillas devueltas
  yPos = drawSectionTitle(doc, 'CANASTILLAS DEVUELTAS', yPos, accent)

  // Agrupar canastillas por tamaño, color, forma y condición
  type CanastillaGroup = { size: string; color: string; shape: string; condition: string; count: number }
  const groupedCanastillas: Record<string, CanastillaGroup> = {}

  for (const item of returnData.canastillas) {
    const size = item.size || 'N/A'
    const color = item.color || 'N/A'
    const shape = item.shape || '-'
    const condition = item.condition || 'N/A'
    const key = `${size}-${color}-${shape}-${condition}`

    if (!groupedCanastillas[key]) {
      groupedCanastillas[key] = { size, color, shape, condition, count: 0 }
    }
    groupedCanastillas[key].count++
  }

  const canastillasData = Object.values(groupedCanastillas).map((group, index) => [
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
    body: canastillasData,
    ...tableStyles(accent),
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 35, halign: 'center' },
      4: { cellWidth: 38, halign: 'center' },
      5: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
    },
  })

  yPos = (doc as any).lastAutoTable.finalY + 10

  // Resumen de facturación
  drawDetailLine(doc, 'Canastillas devueltas:', `${returnData.canastillas.length} unidades`, yPos)
  yPos += 6
  const diasText = returnData.daysCharged === 1 ? '1 día' : `${returnData.daysCharged} días`
  drawDetailLine(doc, 'Días facturados:', diasText, yPos)
  yPos += 6
  drawDetailLine(doc, 'Tarifa por canastilla/día:', `$${rental.daily_rate.toLocaleString('es-CO')}`, yPos)
  yPos += 10

  drawTotalBox(doc, 'TOTAL A PAGAR:', `$${returnData.amount.toLocaleString('es-CO')} COP`, yPos, accent)

  // Notas
  if (returnData.notes) {
    yPos += 20
    yPos = drawSectionTitle(doc, 'OBSERVACIONES', yPos, accent)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.medium)
    const lines = doc.splitTextToSize(returnData.notes, 175)
    lines.forEach((line: string) => {
      doc.text(line, 15, yPos)
      yPos += 4
    })
  }

  // Mensaje de devolución parcial
  if (isPartial) {
    yPos += 20
    doc.setFillColor(254, 243, 199)
    doc.rect(15, yPos, 180, 12, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 83, 9)
    doc.text('NOTA: Esta es una factura parcial. El alquiler permanece activo con', 20, yPos + 5)
    doc.text(`${pendingCount} canastillas pendientes de devolución.`, 20, yPos + 10)
  }

  // Firmas
  drawSignatures(doc, signatureData, ['CLIENTE', 'EMPRESA'])

  // Footer
  drawFooter(doc, accent)

  return doc
}

export const downloadFacturaDevolucionPDF = async (data: FacturaData, signatureData?: SignatureData) => {
  const doc = await generateFacturaDevolucionPDF(data, signatureData)
  const fileName = `Factura_${data.returnData.invoiceNumber}.pdf`
  doc.save(fileName)
}

export const openFacturaDevolucionPDF = async (data: FacturaData, signatureData?: SignatureData) => {
  const doc = await generateFacturaDevolucionPDF(data, signatureData)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}

export const getFacturaDevolucionPDFBlob = async (data: FacturaData, signatureData?: SignatureData): Promise<Blob> => {
  const doc = await generateFacturaDevolucionPDF(data, signatureData)
  return doc.output('blob')
}
