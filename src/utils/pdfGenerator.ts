import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Rental } from '@/types'
import { C, ACCENT, loadLogoBase64, drawHeader, drawSectionTitle, drawInfoCard, drawDetailLine, drawTotalBox, drawFooter as drawFooterBand, tableStyles } from '@/utils/pdfStyles'

export const generateInvoicePDF = async (rental: Rental) => {
  const doc = new jsPDF()

  const accent = ACCENT.blue.main
  const accentDark = ACCENT.blue.dark
  const pageHeight = doc.internal.pageSize.height
  const marginBottom = 45

  // Header profesional
  const logoBase64 = await loadLogoBase64()
  const invoiceDate = new Date(rental.actual_return_date || new Date()).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  let yPos = drawHeader(doc, accent, accentDark, logoBase64, 'FACTURA', rental.invoice_number || 'N/A', invoiceDate)

  // Información del cliente
  yPos = drawSectionTitle(doc, 'FACTURAR A', yPos, accent, 45)
  const badgeText = rental.sale_point?.client_type === 'CLIENTE_EXTERNO' ? 'EXTERNO' : 'P. VENTA'
  const clientLines = [
    `Contacto: ${rental.sale_point?.contact_name || 'N/A'}`,
    `Teléfono: ${rental.sale_point?.contact_phone || 'N/A'}`,
    `Dirección: ${rental.sale_point?.address || 'N/A'}`,
    `Ciudad: ${rental.sale_point?.city || 'N/A'}, ${rental.sale_point?.region || 'N/A'}`,
    ...(rental.sale_point?.identification ? [`NIT/CC: ${rental.sale_point.identification}`] : []),
  ]
  yPos = drawInfoCard(doc, yPos, accent, rental.sale_point?.name || 'N/A', clientLines, { badge: badgeText })

  // Detalles del servicio
  yPos = drawSectionTitle(doc, 'DETALLES DEL SERVICIO', yPos, accent)
  
  const startDate = new Date(rental.start_date).toLocaleDateString('es-CO')
  const endDate = new Date(rental.actual_return_date || new Date()).toLocaleDateString('es-CO')
  const actualDays = rental.actual_days || 0
  const diasText = actualDays === 1 ? '1 día' : `${actualDays} días`

  autoTable(doc, {
    startY: yPos,
    head: [['FECHA DE SALIDA', 'FECHA DE RETORNO', 'DÍAS DE ALQUILER']],
    body: [[startDate, endDate, diasText]],
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: [...C.dark],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [...C.medium],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      fillColor: [...C.light],
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 60 },
      2: { cellWidth: 60 },
    },
  })
  
  yPos = (doc as any).lastAutoTable.finalY + 5
  
  // Advertencia de exceso
  if (rental.estimated_days && actualDays > rental.estimated_days) {
    doc.setFillColor(254, 243, 199)
    doc.rect(15, yPos, 180, 8, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 83, 9)
    doc.text(`⚠ Nota: Excedió ${actualDays - rental.estimated_days} día(s) del período estimado (${rental.estimated_days} días)`, 20, yPos + 5)
    yPos += 10
  }
  
  // Canastillas alquiladas
  yPos += 3
  yPos = drawSectionTitle(doc, 'CANASTILLAS ALQUILADAS', yPos, accent)

  const groupedCanastillas = (rental.rental_items || []).reduce((acc, item) => {
    const key = `${item.canastilla.size}-${item.canastilla.color}`
    if (!acc[key]) {
      acc[key] = {
        size: item.canastilla.size,
        color: item.canastilla.color,
        count: 0
      }
    }
    acc[key].count++
    return acc
  }, {} as Record<string, { size: string; color: string; count: number }>)

  const canastillas = Object.values(groupedCanastillas).map((group, index) => [
    (index + 1).toString(),
    `${group.size} ${group.color}`,
    group.count.toString(),
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'DESCRIPCIÓN', 'CANTIDAD']],
    body: canastillas,
    ...tableStyles(accent),
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 133, fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
    },
  })
  
  yPos = (doc as any).lastAutoTable.finalY + 10
  
  // Cálculo y total
  const canastillasCount = rental.rental_items?.length || 0
  const dailyRate = rental.daily_rate
  const subtotal = canastillasCount * dailyRate * actualDays
  const total = rental.total_amount || subtotal
  
  if (yPos > pageHeight - marginBottom - 50) {
    doc.addPage()
    yPos = 20
  }
  
  drawDetailLine(doc, 'Cantidad de canastillas:', `${canastillasCount} unidades`, yPos)
  yPos += 6
  drawDetailLine(doc, 'Tarifa diaria:', `$${dailyRate.toLocaleString('es-CO')}`, yPos)
  yPos += 6
  drawDetailLine(doc, 'Días de alquiler:', diasText, yPos)
  yPos += 6
  drawDetailLine(doc, 'Subtotal:', `$${subtotal.toLocaleString('es-CO')}`, yPos)
  yPos += 10
  
  drawTotalBox(doc, 'TOTAL A PAGAR:', `$${total.toLocaleString('es-CO')} COP`, yPos, accent)
  yPos += 18
  
  // Términos y condiciones
  if (yPos > pageHeight - marginBottom - 30) {
    doc.addPage()
    yPos = 20
  }
  yPos = drawSectionTitle(doc, 'TÉRMINOS Y CONDICIONES', yPos, accent)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.medium)
  doc.setFontSize(7)
  const terms = [
    '• Las canastillas deben ser devueltas en las mismas condiciones en que fueron entregadas.',
    '• El cliente es responsable por cualquier daño o pérdida de las canastillas durante el período de alquiler.',
    '• Este documento constituye un comprobante válido de la transacción.',
  ]
  terms.forEach(term => {
    doc.text(term, 15, yPos)
    yPos += 4
  })
  
  // Footer profesional en todas las páginas
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooterBand(doc, accent)
  }
  
  return doc
}

export const downloadInvoicePDF = async (rental: Rental) => {
  const doc = await generateInvoicePDF(rental)
  const fileName = `Factura_${rental.invoice_number || 'Sin_Numero'}.pdf`
  doc.save(fileName)
}

export const openInvoicePDF = async (rental: Rental) => {
  const doc = await generateInvoicePDF(rental)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}