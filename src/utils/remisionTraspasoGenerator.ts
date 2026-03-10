import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Transfer, SignatureData } from '@/types'
import { C, ACCENT, loadLogoBase64, drawHeader, drawSectionTitle, drawInfoCard, drawDetailLine, drawSignatures, drawFooter, tableStyles } from '@/utils/pdfStyles'

export const generateRemisionTraspasoPDF = async (transfer: Transfer, signatureData?: SignatureData) => {
  const doc = new jsPDF()

  const isWashingTransfer = transfer.is_washing_transfer || false
  const accentPair = isWashingTransfer ? ACCENT.cyan : ACCENT.purple
  const accent = accentPair.main

  const pageHeight = doc.internal.pageSize.height

  // Header profesional
  const logoBase64 = await loadLogoBase64()
  const tituloRemision = isWashingTransfer ? 'REMISIÓN LAVADO' : 'REMISIÓN TRASPASO'
  const fechaRemision = transfer.remision_generated_at
    ? new Date(transfer.remision_generated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(transfer.requested_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

  let yPos = drawHeader(doc, accent, accentPair.dark, logoBase64, tituloRemision, transfer.remision_number || '', fechaRemision)

  // Información de usuarios - 2 columnas
  yPos = drawSectionTitle(doc, 'ENTREGA', yPos, accent, 35)

  const fromLines = [
    `Email: ${transfer.from_user?.email || ''}`,
    ...(transfer.from_user?.department ? [`Departamento: ${transfer.from_user.department}`] : []),
    ...(transfer.from_user?.area ? [`Área: ${transfer.from_user.area}`] : []),
  ]
  yPos = drawInfoCard(doc, yPos, accent, `${transfer.from_user?.first_name || ''} ${transfer.from_user?.last_name || ''}`, fromLines)

  yPos = drawSectionTitle(doc, 'RECIBE', yPos, accent, 30)

  const toName = transfer.is_external_transfer
    ? (transfer.external_recipient_name || 'Externo')
    : `${transfer.to_user?.first_name || ''} ${transfer.to_user?.last_name || ''}`

  const toLines = transfer.is_external_transfer
    ? [
        ...(transfer.external_recipient_cedula ? [`Cédula: ${transfer.external_recipient_cedula}`] : []),
        ...(transfer.external_recipient_empresa ? [`Empresa: ${transfer.external_recipient_empresa}`] : []),
      ]
    : [
        `Email: ${transfer.to_user?.email || ''}`,
        ...(transfer.to_user?.department ? [`Departamento: ${transfer.to_user.department}`] : []),
        ...(transfer.to_user?.area ? [`Área: ${transfer.to_user.area}`] : []),
      ]
  yPos = drawInfoCard(doc, yPos, accent, toName, toLines)

  // Canastillas
  const tituloCanastillas = isWashingTransfer ? 'CANASTILLAS ENVIADAS A LAVADO' : 'CANASTILLAS TRASPASADAS'
  yPos = drawSectionTitle(doc, tituloCanastillas, yPos, accent)

  // Agrupar canastillas por tamaño, color, forma y condición
  type CanastillaGroup = { size: string; color: string; shape: string; condition: string; count: number }
  const groupedCanastillas: Record<string, CanastillaGroup> = {}

  for (const item of transfer.transfer_items || []) {
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

  // Resumen
  const totalCanastillas = transfer.transfer_items?.length || 0
  const fechaSolicitud = new Date(transfer.requested_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  drawDetailLine(doc, 'Total de canastillas:', `${totalCanastillas} unidades`, yPos)
  yPos += 7
  drawDetailLine(doc, 'Fecha de solicitud:', fechaSolicitud, yPos)
  yPos += 7

  // Notas
  if (transfer.notes) {
    yPos += 5
    yPos = drawSectionTitle(doc, 'OBSERVACIONES', yPos, accent)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.medium)
    const lines = doc.splitTextToSize(transfer.notes, 175)
    lines.forEach((line: string) => {
      doc.text(line, 15, yPos)
      yPos += 4
    })
  }

  // Firmas
  const hasTercero = !!signatureData?.firma_tercero_base64
  const labels: [string, string] | [string, string, string] = hasTercero
    ? ['ENTREGA', 'RECIBE', 'TERCERO']
    : ['ENTREGA', 'RECIBE']
  drawSignatures(doc, signatureData, labels)

  // Footer
  drawFooter(doc, accent)

  return doc
}

export const downloadRemisionTraspasoPDF = async (transfer: Transfer, signatureData?: SignatureData) => {
  const doc = await generateRemisionTraspasoPDF(transfer, signatureData)
  const tipoRemision = transfer.is_washing_transfer ? 'Lavado' : 'Traspaso'
  const fileName = `Remision_${tipoRemision}_${transfer.remision_number}.pdf`
  doc.save(fileName)
}

export const openRemisionTraspasoPDF = async (transfer: Transfer, signatureData?: SignatureData) => {
  const doc = await generateRemisionTraspasoPDF(transfer, signatureData)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}

export const getRemisionTraspasoPDFBlob = async (transfer: Transfer, signatureData?: SignatureData): Promise<Blob> => {
  const doc = await generateRemisionTraspasoPDF(transfer, signatureData)
  return doc.output('blob')
}
