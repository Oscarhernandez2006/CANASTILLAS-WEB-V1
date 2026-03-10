import type jsPDF from 'jspdf'
import type { SignatureData } from '@/types'

export type RGB = [number, number, number]

// Paleta de colores profesional refinada
export const C = {
  black: [0, 0, 0] as RGB,
  dark: [31, 41, 55] as RGB,
  medium: [107, 114, 128] as RGB,
  light: [243, 244, 246] as RGB,
  border: [229, 231, 235] as RGB,
  white: [255, 255, 255] as RGB,
  sigBg: [248, 250, 252] as RGB,
}

// Acentos por tipo de documento
export const ACCENT = {
  blue: { main: [37, 99, 235] as RGB, dark: [29, 78, 216] as RGB },
  purple: { main: [139, 92, 246] as RGB, dark: [124, 58, 237] as RGB },
  cyan: { main: [6, 182, 212] as RGB, dark: [8, 145, 178] as RGB },
  green: { main: [34, 197, 94] as RGB, dark: [22, 163, 74] as RGB },
  teal: { main: [20, 184, 166] as RGB, dark: [13, 148, 136] as RGB },
}

/** Carga el logo de la empresa como base64 */
export async function loadLogoBase64(): Promise<string | null> {
  const paths = [
    `${window.location.origin}/logo.png`,
    '/logo.png',
    './logo.png',
  ]
  for (const path of paths) {
    try {
      const response = await fetch(path)
      const blob = await response.blob()
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch {
      continue
    }
  }
  return null
}

/**
 * Dibuja el header profesional con banda de color, logo, empresa y tarjeta de documento.
 * Retorna el yPos donde inicia el contenido.
 */
export function drawHeader(
  doc: jsPDF,
  accent: RGB,
  accentDark: RGB,
  logoBase64: string | null,
  docType: string,
  docNumber: string,
  docDate: string
): number {
  const pw = 210

  // Banda de color superior
  doc.setFillColor(...accent)
  doc.rect(0, 0, pw, 26, 'F')
  doc.setFillColor(...accentDark)
  doc.rect(0, 26, pw, 1, 'F')

  // Logo sobre la banda
  let cx = 15
  if (logoBase64) {
    doc.setFillColor(255, 255, 255)
    doc.rect(13, 3, 26, 20, 'F')
    try {
      doc.addImage(logoBase64, 'PNG', 14, 4, 24, 18)
    } catch { /* ignore */ }
    cx = 44
  }

  // Información empresa en la banda
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('GRUPO EMPRESARIAL', cx, 9)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('SANTACRUZ', cx, 18)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('Barranquilla, Atlántico  |  Tel: +57 311 758 0698', cx, 24)

  // Tarjeta de documento superpuesta
  const cardX = 52
  const cardW = 106
  const cardY = 20
  const cardH = 24
  doc.setFillColor(255, 255, 255)
  doc.rect(cardX, cardY, cardW, cardH, 'F')
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.rect(cardX, cardY, cardW, cardH, 'S')
  doc.setFillColor(...accent)
  doc.rect(cardX, cardY, cardW, 3.5, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...accent)
  doc.text(docType, 105, cardY + 10, { align: 'center' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text(docNumber, 105, cardY + 17, { align: 'center' })

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.medium)
  doc.text(`Fecha: ${docDate}`, 105, cardY + 22, { align: 'center' })

  return cardY + cardH + 6
}

/**
 * Dibuja un título de sección estilo pill con fondo de color y texto blanco.
 * Retorna el yPos para el contenido siguiente.
 */
export function drawSectionTitle(
  doc: jsPDF,
  title: string,
  yPos: number,
  accent: RGB,
  width?: number
): number {
  const w = width || Math.max(doc.getTextWidth(title) + 12, 40)
  doc.setFillColor(...accent)
  doc.rect(15, yPos - 4, w, 7, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(title, 17, yPos + 0.5)
  return yPos + 10
}

/**
 * Dibuja un badge (pill) pequeño junto al nombre.
 */
export function drawBadge(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  accent: RGB
): void {
  const w = doc.getTextWidth(text) + 6
  doc.setFillColor(...accent)
  doc.rect(x, y - 2, w, 4.5, 'F')
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(text, x + 3, y + 1)
}

/**
 * Dibuja un card de información con fondo claro y borde izquierdo de acento.
 * Retorna el yPos al final del card.
 */
export function drawInfoCard(
  doc: jsPDF,
  yPos: number,
  accent: RGB,
  title: string,
  lines: string[],
  options?: { badge?: string }
): number {
  const cardH = 10 + lines.length * 4.5 + 2
  doc.setFillColor(...C.light)
  doc.rect(15, yPos - 2, 180, cardH, 'F')
  doc.setFillColor(...accent)
  doc.rect(15, yPos - 2, 2, cardH, 'F')

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text(title, 21, yPos + 3)

  if (options?.badge) {
    const nameW = doc.getTextWidth(title)
    drawBadge(doc, options.badge, 23 + nameW, yPos + 3, accent)
  }

  let y = yPos + 8
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.medium)
  lines.forEach(line => {
    doc.text(line, 21, y)
    y += 4.5
  })

  return yPos + cardH + 3
}

/**
 * Dibuja el cuadro total con fondo de acento y texto blanco.
 */
export function drawTotalBox(
  doc: jsPDF,
  label: string,
  value: string,
  yPos: number,
  accent: RGB
): void {
  doc.setFillColor(...accent)
  doc.rect(115, yPos - 3, 80, 13, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(label, 120, yPos + 4)
  doc.setFontSize(13)
  doc.text(value, 190, yPos + 4, { align: 'right' })
}

/**
 * Dibuja las líneas de detalle (label: value) alineadas a la derecha.
 */
export function drawDetailLine(
  doc: jsPDF,
  label: string,
  value: string,
  yPos: number,
  labelX = 118,
  valueX = 193
): void {
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.medium)
  doc.text(label, labelX, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text(value, valueX, yPos, { align: 'right' })
}

/**
 * Dibuja la sección de firmas con fondo gris y soporte para 2 o 3 columnas.
 */
export function drawSignatures(
  doc: jsPDF,
  signatureData: SignatureData | undefined,
  labels: [string, string] | [string, string, string]
): void {
  const pageHeight = doc.internal.pageSize.height
  const hasSignatures = !!(signatureData?.firma_entrega_base64 || signatureData?.firma_recibe_base64)
  const hasTercero = labels.length === 3 && !!signatureData?.firma_tercero_base64

  const boxH = hasSignatures ? 50 : 30
  const firmasY = pageHeight - 12 - boxH - 2

  // Background box
  doc.setFillColor(...C.sigBg)
  doc.rect(15, firmasY, 180, boxH, 'F')
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.rect(15, firmasY, 180, boxH, 'S')

  // Title
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text('FIRMAS DE CONFORMIDAD', 105, firmasY + 5, { align: 'center' })

  const firmaLineY = hasSignatures ? firmasY + 32 : firmasY + 18

  interface ColDef {
    x: number
    endX: number
    cx: number
    label: string
    sig?: string
    name?: string
    cedula?: string
  }

  const drawCols = (cols: ColDef[]) => {
    cols.forEach(col => {
      if (col.sig) {
        try { doc.addImage(col.sig, 'PNG', col.x, firmasY + 8, col.endX - col.x - 2, 20) } catch { /* ignore */ }
      }
      doc.setDrawColor(...C.medium)
      doc.setLineWidth(0.5)
      doc.line(col.x, firmaLineY, col.endX, firmaLineY)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C.dark)
      doc.text(col.label, col.cx, firmaLineY + 4, { align: 'center' })
      doc.setFontSize(6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.medium)
      doc.text(`Nombre: ${col.name || ''}`, col.x, firmaLineY + 8)
      doc.text(`Cédula: ${col.cedula || ''}`, col.x, firmaLineY + 12)
    })
  }

  if (hasTercero) {
    drawCols([
      { x: 17, endX: 72, cx: 44.5, label: labels[0], sig: signatureData?.firma_entrega_base64, name: signatureData?.firma_entrega_nombre, cedula: signatureData?.firma_entrega_cedula },
      { x: 76, endX: 133, cx: 104.5, label: labels[1], sig: signatureData?.firma_recibe_base64, name: signatureData?.firma_recibe_nombre, cedula: signatureData?.firma_recibe_cedula },
      { x: 137, endX: 193, cx: 165, label: labels[2], sig: signatureData?.firma_tercero_base64, name: signatureData?.firma_tercero_nombre, cedula: signatureData?.firma_tercero_cedula },
    ])
  } else {
    drawCols([
      { x: 22, endX: 85, cx: 53.5, label: labels[0], sig: signatureData?.firma_entrega_base64, name: signatureData?.firma_entrega_nombre, cedula: signatureData?.firma_entrega_cedula },
      { x: 122, endX: 188, cx: 155, label: labels[1], sig: signatureData?.firma_recibe_base64, name: signatureData?.firma_recibe_nombre, cedula: signatureData?.firma_recibe_cedula },
    ])
  }
}

/**
 * Dibuja el footer profesional con banda de color en la parte inferior.
 */
export function drawFooter(doc: jsPDF, accent: RGB): void {
  const pw = 210
  const ph = doc.internal.pageSize.height
  doc.setFillColor(...accent)
  doc.rect(0, ph - 10, pw, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('SANTACRUZ  •  Sistema de Gestión de Canastillas  •  Barranquilla, Atlántico', 105, ph - 5, { align: 'center' })
  doc.setFontSize(5.5)
  doc.text(`Documento generado: ${new Date().toLocaleString('es-CO')}`, 105, ph - 2, { align: 'center' })
}

/** Estilo profesional para autoTable */
export function tableStyles(accent: RGB) {
  return {
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: [...C.border] as RGB,
      lineWidth: 0.2,
      textColor: [...C.dark] as RGB,
    },
    headStyles: {
      fillColor: [...accent] as RGB,
      textColor: [255, 255, 255] as RGB,
      fontStyle: 'bold' as const,
      fontSize: 8,
      halign: 'center' as const,
    },
    alternateRowStyles: {
      fillColor: [...C.light] as RGB,
    },
  }
}
