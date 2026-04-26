/**
 * @module facturaPerdidaGenerator
 * @description Genera PDFs de factura estilo DIAN colombiana — diseño profesional, limpio y minimalista.
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SignatureData } from '@/types'
import { loadLogoBase64, drawSignatures } from '@/utils/pdfStyles'

// Colores DIAN-style (escala de grises profesional)
const BK: [number, number, number] = [0, 0, 0]
const DK: [number, number, number] = [33, 33, 33]
const MD: [number, number, number] = [100, 100, 100]
const LT: [number, number, number] = [130, 130, 130]
const BG: [number, number, number] = [245, 245, 245]
const BD: [number, number, number] = [180, 180, 180]
const WH: [number, number, number] = [255, 255, 255]

export interface FacturaPerdidaPDFData {
  invoiceNumber: string
  billedTo: {
    name: string
    contact?: string
    phone?: string
    address?: string
    identification?: string
    type: 'usuario' | 'cliente'
  }
  items: {
    descripcion: string
    cantidad: number
    valor_unitario: number
    subtotal: number
  }[]
  totalCanastillas: number
  totalAmount: number
  notes?: string
  createdAt: string
  createdByName: string
}

/** Dibuja un rectángulo con borde fino negro */
function box(doc: jsPDF, x: number, y: number, w: number, h: number, fill?: [number, number, number]) {
  if (fill) { doc.setFillColor(...fill); doc.rect(x, y, w, h, 'F') }
  doc.setDrawColor(...BK)
  doc.setLineWidth(0.4)
  doc.rect(x, y, w, h, 'S')
}

/** Texto con posición */
function txt(doc: jsPDF, text: string, x: number, y: number, opts?: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'center' | 'right' | 'left' }) {
  doc.setFontSize(opts?.size || 8)
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  doc.setTextColor(...(opts?.color || DK))
  doc.text(text, x, y, { align: opts?.align || 'left' })
}

/** Fila de campo: label + value en una línea */
function field(doc: jsPDF, label: string, value: string, x: number, y: number) {
  txt(doc, label, x, y, { size: 7, bold: true, color: MD })
  const lw = doc.getTextWidth(label)
  txt(doc, value, x + lw + 2, y, { size: 7.5 })
}

export const generateFacturaPerdidaPDF = async (
  data: FacturaPerdidaPDFData,
  signatureData?: SignatureData
) => {
  const doc = new jsPDF()
  const pw = 210
  const mx = 12 // margen horizontal
  const cw = pw - mx * 2 // ancho contenido

  const logoBase64 = await loadLogoBase64()
  const fechaFactura = new Date(data.createdAt).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  // ════════════════════════════════════════════════════════
  // ENCABEZADO PRINCIPAL — Borde exterior con logo + datos empresa + cuadro factura
  // ════════════════════════════════════════════════════════
  const headerH = 32
  box(doc, mx, 8, cw, headerH)

  // Columna izquierda: Logo + empresa
  const divX = mx + cw * 0.55
  doc.setDrawColor(...BK)
  doc.setLineWidth(0.4)
  doc.line(divX, 8, divX, 8 + headerH)

  let logoEndX = mx + 5
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', mx + 4, 11, 22, 22) } catch { /* */ }
    logoEndX = mx + 30
  }

  txt(doc, 'GRUPO EMPRESARIAL SANTACRUZ', logoEndX, 16, { size: 11, bold: true })
  txt(doc, 'NIT: 901.234.567-8', logoEndX, 21, { size: 7.5, color: MD })
  txt(doc, 'Barranquilla, Atlántico — Colombia', logoEndX, 25.5, { size: 7, color: LT })
  txt(doc, 'Tel: +57 311 758 0698', logoEndX, 29.5, { size: 7, color: LT })
  txt(doc, 'info@gruposantacruz.com', logoEndX, 33.5, { size: 7, color: LT })

  // Columna derecha: Tipo + número + fecha
  const rxC = divX + (mx + cw - divX) / 2
  txt(doc, 'FACTURA DE VENTA', rxC, 16, { size: 10, bold: true, align: 'center' })

  // Línea separadora dentro de la tarjeta derecha
  doc.setDrawColor(...BD)
  doc.setLineWidth(0.2)
  doc.line(divX + 4, 19, mx + cw - 4, 19)

  txt(doc, `No. ${data.invoiceNumber}`, rxC, 25, { size: 12, bold: true, align: 'center' })
  txt(doc, `Fecha: ${fechaFactura}`, rxC, 31, { size: 8, color: MD, align: 'center' })
  txt(doc, `Emitida por: ${data.createdByName}`, rxC, 35.5, { size: 6.5, color: LT, align: 'center' })

  let yPos = 8 + headerH + 3

  // ════════════════════════════════════════════════════════
  // DATOS DEL CLIENTE
  // ════════════════════════════════════════════════════════
  const clientH = 22
  box(doc, mx, yPos, cw, clientH, BG)
  box(doc, mx, yPos, cw, 6) // header bar
  txt(doc, 'DATOS DEL CLIENTE', mx + cw / 2, yPos + 4.2, { size: 7.5, bold: true, align: 'center' })

  const cy = yPos + 10
  const col1 = mx + 4
  const col2 = mx + cw / 2 + 4

  field(doc, 'Nombre / Razón Social:', data.billedTo.name, col1, cy)
  field(doc, 'Tipo:', data.billedTo.type === 'cliente' ? 'Cliente externo' : 'Usuario del sistema', col2, cy)

  const nit = data.billedTo.identification || 'N/A'
  field(doc, 'NIT / C.C.:', nit, col1, cy + 5.5)

  const phone = data.billedTo.phone || 'N/A'
  field(doc, 'Teléfono:', phone, col2, cy + 5.5)

  if (data.billedTo.address) {
    field(doc, 'Dirección:', data.billedTo.address, col1, cy + 11)
  }
  if (data.billedTo.contact) {
    field(doc, 'Contacto:', data.billedTo.contact, col2, cy + 11)
  }

  yPos += clientH + 3

  // ════════════════════════════════════════════════════════
  // TABLA DE ÍTEMS — Estilo DIAN: bordes negros finos, header gris claro
  // ════════════════════════════════════════════════════════
  const tableData = data.items.map((item, i) => [
    (i + 1).toString(),
    item.descripcion,
    item.cantidad.toString(),
    `$${item.valor_unitario.toLocaleString('es-CO')}`,
    `$${item.subtotal.toLocaleString('es-CO')}`,
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'DESCRIPCIÓN', 'CANTIDAD', 'VR. UNITARIO', 'SUBTOTAL']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      lineColor: BK,
      lineWidth: 0.3,
      textColor: DK,
    },
    headStyles: {
      fillColor: BG,
      textColor: BK,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      cellPadding: 3,
    },
    bodyStyles: {
      fillColor: WH,
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252],
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 78 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 34, halign: 'right' },
      4: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: mx, right: mx },
  })

  yPos = (doc as any).lastAutoTable.finalY

  // ════════════════════════════════════════════════════════
  // TOTALES — Alineado a la derecha, estilo DIAN
  // ════════════════════════════════════════════════════════
  const totW = 80
  const totX = mx + cw - totW
  const rowH = 7

  // Subtotal
  box(doc, totX, yPos, totW, rowH)
  txt(doc, 'SUBTOTAL', totX + 4, yPos + 5, { size: 7.5, bold: true, color: MD })
  txt(doc, `$${data.totalAmount.toLocaleString('es-CO')}`, totX + totW - 4, yPos + 5, { size: 7.5, align: 'right' })

  // IVA
  box(doc, totX, yPos + rowH, totW, rowH)
  txt(doc, 'IVA (0%)', totX + 4, yPos + rowH + 5, { size: 7.5, bold: true, color: MD })
  txt(doc, '$0', totX + totW - 4, yPos + rowH + 5, { size: 7.5, align: 'right' })

  // Total unidades (lado izquierdo)
  box(doc, mx, yPos, cw - totW, rowH * 2)
  txt(doc, `Total ítems: ${data.items.length}  |  Total unidades: ${data.totalCanastillas}`, mx + 4, yPos + 9, { size: 7, color: MD })

  // TOTAL (fila destacada)
  const totalRowY = yPos + rowH * 2
  box(doc, totX, totalRowY, totW, rowH + 2, [33, 33, 33])
  txt(doc, 'TOTAL A PAGAR', totX + 4, totalRowY + 6, { size: 8.5, bold: true, color: WH })
  txt(doc, `$${data.totalAmount.toLocaleString('es-CO')}`, totX + totW - 4, totalRowY + 6, { size: 9.5, bold: true, color: WH, align: 'right' })

  // Línea izquierda junto al total
  box(doc, mx, totalRowY, cw - totW, rowH + 2)

  yPos = totalRowY + rowH + 6

  // ════════════════════════════════════════════════════════
  // OBSERVACIONES
  // ════════════════════════════════════════════════════════
  if (data.notes) {
    const notesLines = doc.splitTextToSize(data.notes, cw - 12)
    const notesH = 8 + notesLines.length * 4
    box(doc, mx, yPos, cw, notesH, BG)
    txt(doc, 'OBSERVACIONES:', mx + 4, yPos + 5, { size: 7, bold: true, color: MD })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DK)
    let ny = yPos + 5
    notesLines.forEach((line: string) => {
      ny += 4
      doc.text(line, mx + 4, ny)
    })
    yPos += notesH + 4
  }

  // ════════════════════════════════════════════════════════
  // FIRMA
  // ════════════════════════════════════════════════════════
  drawSignatures(doc, signatureData, ['EMITIDO POR'], yPos)

  // ════════════════════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════════════════════
  const ph = doc.internal.pageSize.height
  doc.setDrawColor(...BD)
  doc.setLineWidth(0.3)
  doc.line(mx, ph - 12, pw - mx, ph - 12)

  txt(doc, 'GRUPO EMPRESARIAL SANTACRUZ', mx + 2, ph - 8, { size: 6, bold: true, color: MD })
  txt(doc, 'Sistema de Gestión de Canastillas  •  Barranquilla, Atlántico', mx + 2, ph - 5, { size: 5.5, color: LT })
  txt(doc, `Generado: ${new Date().toLocaleString('es-CO')}`, pw - mx - 2, ph - 5, { size: 5.5, color: LT, align: 'right' })
  txt(doc, 'Documento equivalente — Uso interno', pw / 2, ph - 2, { size: 5, color: BD, align: 'center' })

  return doc
}

export const openFacturaPerdidaPDF = async (data: FacturaPerdidaPDFData, signatureData?: SignatureData) => {
  const doc = await generateFacturaPerdidaPDF(data, signatureData)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}

export const getFacturaPerdidaPDFBlob = async (data: FacturaPerdidaPDFData, signatureData?: SignatureData): Promise<Blob> => {
  const doc = await generateFacturaPerdidaPDF(data, signatureData)
  return doc.output('blob')
}
