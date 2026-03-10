import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { WashingOrder, SignatureData } from '@/types'
import { calculateOrderTimes } from '@/services/washingService'
import { C, ACCENT, loadLogoBase64, drawHeader, drawSectionTitle, drawInfoCard, drawDetailLine, drawSignatures, drawFooter, tableStyles } from '@/utils/pdfStyles'

export const generateRemisionLavadoPDF = async (
  order: WashingOrder,
  tipo: 'ENTREGA' | 'DEVOLUCION',
  signatureData?: SignatureData
) => {
  const doc = new jsPDF()

  const accentPair = tipo === 'ENTREGA' ? ACCENT.blue : ACCENT.teal
  const accent = accentPair.main
  const pageHeight = doc.internal.pageSize.height
  const remisionNumber = tipo === 'ENTREGA' ? order.remision_entrega_number : order.remision_devolucion_number

  // Header profesional
  const logoBase64 = await loadLogoBase64()
  const tipoText = tipo === 'ENTREGA' ? 'REMISIÓN LAVADO' : 'REMISIÓN DEVOLUCIÓN'
  const fecha = tipo === 'ENTREGA' ? order.sent_at : order.delivered_at
  const fechaStr = fecha ? new Date(fecha).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  }) : ''
  let yPos = drawHeader(doc, accent, accentPair.dark, logoBase64, tipoText, remisionNumber || '', fechaStr)

  // Información de usuarios
  const userFrom = tipo === 'ENTREGA' ? order.sender_user : order.washing_staff
  const labelFrom = tipo === 'ENTREGA' ? 'ENVIADO POR' : 'DEVUELTO POR'
  yPos = drawSectionTitle(doc, labelFrom, yPos, accent, 45)
  yPos = drawInfoCard(doc, yPos, accent, `${userFrom?.first_name || ''} ${userFrom?.last_name || ''}`, [
    `Email: ${userFrom?.email || ''}`,
  ])

  const userTo = tipo === 'ENTREGA' ? order.washing_staff : order.sender_user
  const labelTo = tipo === 'ENTREGA' ? 'RECIBE (LAVADO)' : 'RECIBE'
  yPos = drawSectionTitle(doc, labelTo, yPos, accent, 50)
  yPos = drawInfoCard(doc, yPos, accent, `${userTo?.first_name || ''} ${userTo?.last_name || ''}`, [
    `Email: ${userTo?.email || ''}`,
  ])

  // Canastillas
  yPos = drawSectionTitle(doc, 'CANASTILLAS', yPos, accent)

  // Agrupar canastillas por tamaño y color
  const groupedCanastillas = (order.washing_items || []).reduce((acc, item) => {
    const key = `${item.canastilla?.size}-${item.canastilla?.color}`
    if (!acc[key]) {
      acc[key] = {
        size: item.canastilla?.size || '',
        color: item.canastilla?.color || '',
        count: 0,
        status: item.item_status
      }
    }
    acc[key].count++
    return acc
  }, {} as Record<string, { size: string; color: string; count: number; status: string }>)

  const canastillasData = Object.values(groupedCanastillas).map((group, index) => {
    const row = [
      (index + 1).toString(),
      `${group.size} - ${group.color}`,
      group.count.toString(),
    ]
    if (tipo === 'DEVOLUCION') {
      row.push(group.status === 'LAVADA' ? 'LAVADA' : group.status === 'DANADA' ? 'DAÑADA' : 'PENDIENTE')
    }
    return row
  })

  const headers = tipo === 'ENTREGA'
    ? [['#', 'DESCRIPCIÓN', 'CANTIDAD']]
    : [['#', 'DESCRIPCIÓN', 'CANTIDAD', 'ESTADO']]

  autoTable(doc, {
    startY: yPos,
    head: headers,
    body: canastillasData,
    ...tableStyles(accent),
    theme: 'grid',
    columnStyles: tipo === 'ENTREGA' ? {
      0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 135, fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
    } : {
      0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 100, fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
    },
  })

  yPos = (doc as any).lastAutoTable.finalY + 10

  // Resumen
  const totalCanastillas = order.washing_items?.length || 0
  drawDetailLine(doc, 'Total de canastillas:', `${totalCanastillas} unidades`, yPos)

  if (tipo === 'DEVOLUCION') {
    const times = calculateOrderTimes(order)

    yPos += 7
    drawDetailLine(doc, 'Tiempo de lavado:', `${times.washingTime || 0} horas`, yPos)

    const lavadas = order.washing_items?.filter(i => i.item_status === 'LAVADA').length || 0
    const danadas = order.washing_items?.filter(i => i.item_status === 'DANADA').length || 0

    yPos += 7
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.medium)
    doc.text('Canastillas lavadas:', 118, yPos)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(34, 197, 94)
    doc.text(`${lavadas}`, 193, yPos, { align: 'right' })

    if (danadas > 0) {
      yPos += 6
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.medium)
      doc.text('Canastillas dañadas:', 118, yPos)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(239, 68, 68)
      doc.text(`${danadas}`, 193, yPos, { align: 'right' })
    }
  }

  // Notas
  if (order.notes) {
    yPos += 10
    yPos = drawSectionTitle(doc, 'OBSERVACIONES', yPos, accent)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.medium)
    const lines = doc.splitTextToSize(order.notes, 175)
    lines.forEach((line: string) => {
      doc.text(line, 15, yPos)
      yPos += 4
    })
  }

  // Firmas
  drawSignatures(doc, signatureData, ['ENTREGA', 'RECIBE'])

  // Footer
  drawFooter(doc, accent)

  return doc
}

export const downloadRemisionLavadoPDF = async (order: WashingOrder, tipo: 'ENTREGA' | 'DEVOLUCION', signatureData?: SignatureData) => {
  const doc = await generateRemisionLavadoPDF(order, tipo, signatureData)
  const remisionNumber = tipo === 'ENTREGA' ? order.remision_entrega_number : order.remision_devolucion_number
  const fileName = `Remision_Lavado_${remisionNumber}.pdf`
  doc.save(fileName)
}

export const openRemisionLavadoPDF = async (order: WashingOrder, tipo: 'ENTREGA' | 'DEVOLUCION', signatureData?: SignatureData) => {
  const doc = await generateRemisionLavadoPDF(order, tipo, signatureData)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}

export const getRemisionLavadoPDFBlob = async (order: WashingOrder, tipo: 'ENTREGA' | 'DEVOLUCION', signatureData?: SignatureData): Promise<Blob> => {
  const doc = await generateRemisionLavadoPDF(order, tipo, signatureData)
  return doc.output('blob')
}
