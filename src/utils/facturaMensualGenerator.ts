/**
 * @module facturaMensualGenerator
 * @description Genera PDFs de factura mensual.
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SignatureData, SalePoint } from '@/types'
import { C, ACCENT, type RGB, loadLogoBase64, drawHeader, drawSectionTitle, drawInfoCard, drawDetailLine, drawTotalBox, drawSignatures, drawFooter, tableStyles } from '@/utils/pdfStyles'

export interface FacturaMensualPDFData {
  invoiceNumber: string
  salePoint: SalePoint
  month: number
  year: number
  subFacturas: {
    invoice_number: string
    return_date: string
    days_charged: number
    amount: number
    items_count: number
    rental_type: string
    remision_number?: string
    daily_rate: number
  }[]
  totalAmount: number
  totalCanastillas: number
  notes?: string
  discount?: number
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export const generateFacturaMensualPDF = async (
  data: FacturaMensualPDFData,
  signatureData?: SignatureData
) => {
  const doc = new jsPDF()
  const accent = ACCENT.teal.main
  const accentDark = ACCENT.teal.dark

  // Header
  const logoBase64 = await loadLogoBase64()
  const periodoTexto = `${MESES[data.month - 1]} ${data.year}`
  let yPos = drawHeader(doc, accent, accentDark, logoBase64, 'FACTURA MENSUAL', data.invoiceNumber, periodoTexto)

  // Información del cliente
  yPos = drawSectionTitle(doc, 'FACTURAR A', yPos, accent)
  const badgeText = data.salePoint.client_type === 'CLIENTE_EXTERNO' ? 'EXTERNO' : 'P. VENTA'
  const clientLines = [
    `Contacto: ${data.salePoint.contact_name || 'N/A'}`,
    `Teléfono: ${data.salePoint.contact_phone || 'N/A'}`,
    `Dirección: ${data.salePoint.address || 'N/A'}`,
    ...(data.salePoint.identification ? [`NIT/CC: ${data.salePoint.identification}`] : []),
  ]
  yPos = drawInfoCard(doc, yPos, accent, data.salePoint.name || 'N/A', clientLines, { badge: badgeText })

  // Período de facturación
  const periodoLines = [
    `Período: ${MESES[data.month - 1]} ${data.year}`,
    `Sub-facturas consolidadas: ${data.subFacturas.length}`,
    `Total canastillas: ${data.totalCanastillas}`,
  ]
  yPos = drawInfoCard(doc, yPos, accent, 'PERÍODO DE FACTURACIÓN', periodoLines)

  // Detalle de sub-facturas
  yPos = drawSectionTitle(doc, 'DETALLE DE SUB-FACTURAS', yPos, accent)

  const tableData = data.subFacturas.map((sf, i) => [
    (i + 1).toString(),
    sf.invoice_number,
    sf.rental_type,
    new Date(sf.return_date).toLocaleDateString('es-CO'),
    sf.remision_number || '-',
    sf.items_count.toString(),
    sf.days_charged.toString(),
    `$${sf.daily_rate.toLocaleString('es-CO')}`,
    `$${sf.amount.toLocaleString('es-CO')}`,
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Nº FACTURA', 'TIPO', 'FECHA', 'REMISIÓN', 'CANAST.', 'DÍAS', 'TARIFA', 'MONTO']],
    body: tableData,
    ...tableStyles(accent),
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 28, halign: 'center', fontSize: 6.5 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 24, halign: 'center', fontSize: 6.5 },
      5: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    foot: [[
      '', '', '', '', 'TOTALES', data.totalCanastillas.toString(), '', '',
      `$${data.totalAmount.toLocaleString('es-CO')}`
    ]],
    footStyles: {
      fillColor: [240, 240, 240] as RGB,
      textColor: [...C.dark] as RGB,
      fontStyle: 'bold',
      fontSize: 8,
    },
  })

  yPos = (doc as any).lastAutoTable.finalY + 10

  // Verificar si hay espacio para resumen + total + firmas + footer (~90px)
  const pageH = doc.internal.pageSize.height
  const spaceNeeded = 90
  if (yPos + spaceNeeded > pageH) {
    doc.addPage()
    yPos = 20
  }

  // Resumen de facturación
  drawDetailLine(doc, 'Sub-facturas consolidadas:', `${data.subFacturas.length}`, yPos)
  yPos += 6
  drawDetailLine(doc, 'Total canastillas facturadas:', `${data.totalCanastillas} unidades`, yPos)
  yPos += 6
  drawDetailLine(doc, 'Subtotal:', `$${data.totalAmount.toLocaleString('es-CO')}`, yPos)
  yPos += 6

  // Descuento (si aplica)
  const discount = data.discount || 0
  if (discount > 0) {
    doc.setFillColor(254, 243, 199)
    doc.rect(113, yPos - 4, 82, 12, 'F')
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 83, 9)
    doc.text('DESCUENTO:', 118, yPos + 3)
    doc.text(`- $${discount.toLocaleString('es-CO')} COP`, 191, yPos + 3, { align: 'right' })
    yPos += 14
  }

  const totalConDescuento = data.totalAmount - discount
  drawTotalBox(doc, 'TOTAL FACTURA MENSUAL:', `$${totalConDescuento.toLocaleString('es-CO')} COP`, yPos, accent)
  yPos += 20

  // Notas
  if (data.notes) {
    yPos = drawSectionTitle(doc, 'OBSERVACIONES', yPos, accent)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...(C.medium as RGB))
    const lines = doc.splitTextToSize(data.notes, 175)
    lines.forEach((line: string) => {
      doc.text(line, 15, yPos)
      yPos += 4
    })
  }

  // Firma - solo quien factura (pasar yPos para evitar solapamientos)
  drawSignatures(doc, signatureData, ['FACTURADO POR'], yPos)

  // Footer
  drawFooter(doc, accent)

  return doc
}

export const openFacturaMensualPDF = async (
  data: FacturaMensualPDFData,
  signatureData?: SignatureData
) => {
  const doc = await generateFacturaMensualPDF(data, signatureData)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}

export const getFacturaMensualPDFBlob = async (
  data: FacturaMensualPDFData,
  signatureData?: SignatureData
): Promise<Blob> => {
  const doc = await generateFacturaMensualPDF(data, signatureData)
  return doc.output('blob')
}
