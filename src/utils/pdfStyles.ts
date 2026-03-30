/**
 * @module pdfStyles
 * @description Estilos compartidos para generación de PDFs.
 */
import type jsPDF from 'jspdf'
import type { SignatureData } from '@/types'

export type RGB = [number, number, number]

// Paleta corporativa refinada
export const C = {
  black: [0, 0, 0] as RGB,
  dark: [23, 23, 23] as RGB,
  darkGray: [55, 65, 81] as RGB,
  medium: [107, 114, 128] as RGB,
  light: [249, 250, 251] as RGB,
  border: [209, 213, 219] as RGB,
  borderLight: [229, 231, 235] as RGB,
  white: [255, 255, 255] as RGB,
  sigBg: [250, 251, 252] as RGB,
  muted: [156, 163, 175] as RGB,
}

// Acentos por tipo de documento
export const ACCENT = {
  blue: { main: [30, 64, 175] as RGB, dark: [23, 37, 84] as RGB },
  purple: { main: [109, 40, 217] as RGB, dark: [76, 29, 149] as RGB },
  cyan: { main: [14, 116, 144] as RGB, dark: [21, 94, 117] as RGB },
  green: { main: [21, 128, 61] as RGB, dark: [20, 83, 45] as RGB },
  teal: { main: [15, 118, 110] as RGB, dark: [17, 94, 89] as RGB },
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
 * Header corporativo: barra fina superior de acento, logo grande, info empresa elegante,
 * tarjeta de documento con borde fino y tipografía refinada.
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

  // Barra fina de acento en el borde superior
  doc.setFillColor(...accentDark)
  doc.rect(0, 0, pw, 3, 'F')

  // Fondo blanco para el header
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 3, pw, 32, 'F')

  // Logo
  let infoX = 15
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, 6, 28, 24)
    } catch { /* ignore */ }
    infoX = 48
  }

  // Nombre empresa - tipografía elegante
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...C.muted)
  doc.text('GRUPO EMPRESARIAL', infoX, 12)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...C.dark)
  doc.text('SANTACRUZ', infoX, 21)

  // Subtítulo de dirección  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...C.medium)
  doc.text('Barranquilla, Atlántico', infoX, 26)
  doc.text('Tel: +57 311 758 0698', infoX, 30)

  // Tarjeta de documento (esquina derecha)
  const cardW = 62
  const cardX = pw - cardW - 12
  const cardY = 6
  const cardH = 27

  // Borde superior de la tarjeta con acento
  doc.setFillColor(...accent)
  doc.rect(cardX, cardY, cardW, 2, 'F')

  // Cuerpo de la tarjeta
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.4)
  doc.rect(cardX, cardY + 2, cardW, cardH - 2, 'S')

  const cardCx = cardX + cardW / 2

  // Tipo de documento
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...accent)
  doc.text(docType, cardCx, cardY + 8, { align: 'center' })

  // Número de documento
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text(docNumber, cardCx, cardY + 15, { align: 'center' })

  // Fecha
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.medium)
  doc.text(docDate, cardCx, cardY + 21, { align: 'center' })

  // Línea horizontal separadora
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.5)
  doc.line(12, 36, pw - 12, 36)

  return 44
}

/**
 * Título de sección corporativo: icono cuadrado de acento + texto oscuro + línea extendida.
 */
export function drawSectionTitle(
  doc: jsPDF,
  title: string,
  yPos: number,
  accent: RGB,
  _width?: number
): number {
  // Cuadrado indicador de acento
  doc.setFillColor(...accent)
  doc.rect(15, yPos - 3.5, 3, 5, 'F')

  // Texto del título
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text(title, 21, yPos + 0.5)

  // Línea fina extendida
  const textW = doc.getTextWidth(title)
  doc.setDrawColor(...C.borderLight)
  doc.setLineWidth(0.3)
  doc.line(23 + textW, yPos, 195, yPos)

  return yPos + 8
}

/**
 * Badge corporativo: contorno redondeado con texto pequeño.
 */
export function drawBadge(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  accent: RGB
): void {
  const w = doc.getTextWidth(text) + 6
  doc.setDrawColor(...accent)
  doc.setLineWidth(0.4)
  doc.rect(x, y - 2.5, w, 5, 'S')
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...accent)
  doc.text(text, x + 3, y + 0.5)
}

/**
 * Card de información corporativo: fondo blanco con borde fino, borde izquierdo de acento.
 */
export function drawInfoCard(
  doc: jsPDF,
  yPos: number,
  accent: RGB,
  title: string,
  lines: string[],
  options?: { badge?: string }
): number {
  const cardH = 10 + lines.length * 5 + 3

  // Fondo blanco con borde
  doc.setFillColor(255, 255, 255)
  doc.rect(15, yPos - 2, 180, cardH, 'F')
  doc.setDrawColor(...C.borderLight)
  doc.setLineWidth(0.3)
  doc.rect(15, yPos - 2, 180, cardH, 'S')

  // Borde izquierdo de acento
  doc.setFillColor(...accent)
  doc.rect(15, yPos - 2, 2.5, cardH, 'F')

  // Nombre/título
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text(title, 22, yPos + 4)

  if (options?.badge) {
    const nameW = doc.getTextWidth(title)
    drawBadge(doc, options.badge, 24 + nameW, yPos + 4, accent)
  }

  // Línea fina separadora bajo el nombre
  doc.setDrawColor(...C.borderLight)
  doc.setLineWidth(0.2)
  doc.line(22, yPos + 6.5, 192, yPos + 6.5)

  // Datos
  let y = yPos + 11
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.darkGray)
  lines.forEach(line => {
    doc.text(line, 22, y)
    y += 5
  })

  return yPos + cardH + 4
}

/**
 * Caja de total con borde y fondo de acento suave.
 */
export function drawTotalBox(
  doc: jsPDF,
  label: string,
  value: string,
  yPos: number,
  accent: RGB
): void {
  // Fondo suave de acento
  doc.setFillColor(accent[0], accent[1], accent[2])
  doc.rect(115, yPos - 4, 80, 14, 'F')

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(label, 120, yPos + 4)

  doc.setFontSize(13)
  doc.text(value, 191, yPos + 4, { align: 'right' })
}

/**
 * Línea de detalle label-valor alineada a la derecha.
 */
export function drawDetailLine(
  doc: jsPDF,
  label: string,
  value: string,
  yPos: number,
  labelX = 118,
  valueX = 193
): void {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.medium)
  doc.text(label, labelX, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.dark)
  doc.text(value, valueX, yPos, { align: 'right' })
}

/**
 * Sección de firmas profesional: área blanca con borde, título centrado,
 * columnas de firma con líneas y datos personales.
 */
export function drawSignatures(
  doc: jsPDF,
  signatureData: SignatureData | undefined,
  labels: [string] | [string, string] | [string, string, string],
  contentEndY?: number
): void {
  const pageHeight = doc.internal.pageSize.height
  const hasSignatures = !!(signatureData?.firma_entrega_base64 || signatureData?.firma_recibe_base64)
  const hasTercero = labels.length === 3 && !!signatureData?.firma_tercero_base64
  const isSingleSignature = labels.length === 1

  const boxH = hasSignatures ? 52 : 32
  let firmasY = pageHeight - 12 - boxH - 2

  // Si el contenido se extiende hasta la zona de firmas, agregar nueva página
  if (contentEndY && contentEndY > firmasY - 5) {
    doc.addPage()
    firmasY = 20
  }

  // Contenedor con fondo blanco y borde fino
  doc.setFillColor(255, 255, 255)
  doc.rect(12, firmasY, 186, boxH, 'F')
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.4)
  doc.rect(12, firmasY, 186, boxH, 'S')

  // Línea superior de acento (toma el color del borde)
  doc.setDrawColor(...C.darkGray)
  doc.setLineWidth(0.6)
  doc.line(12, firmasY, 198, firmasY)

  // Título dinámico
  const titulo = isSingleSignature ? 'FIRMA RESPONSABLE' : 'FIRMAS DE CONFORMIDAD'
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.darkGray)
  doc.text(titulo, 105, firmasY + 5, { align: 'center' })

  // Línea decorativa bajo el título
  doc.setDrawColor(...C.borderLight)
  doc.setLineWidth(0.2)
  doc.line(60, firmasY + 7, 150, firmasY + 7)

  const firmaLineY = hasSignatures ? firmasY + 34 : firmasY + 20

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
      // Imagen de firma
      if (col.sig) {
        try { doc.addImage(col.sig, 'PNG', col.x + 2, firmasY + 9, col.endX - col.x - 6, 22) } catch { /* ignore */ }
      }

      // Línea de firma
      doc.setDrawColor(...C.darkGray)
      doc.setLineWidth(0.4)
      doc.line(col.x, firmaLineY, col.endX, firmaLineY)

      // Label de firma
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C.dark)
      doc.text(col.label, col.cx, firmaLineY + 4, { align: 'center' })

      // Nombre y cédula
      doc.setFontSize(5.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.medium)
      if (col.name) doc.text(`Nombre: ${col.name}`, col.x, firmaLineY + 8)
      if (col.cedula) doc.text(`C.C.: ${col.cedula}`, col.x, firmaLineY + 11.5)
    })
  }

  if (isSingleSignature) {
    // Una sola firma centrada
    drawCols([
      { x: 55, endX: 155, cx: 105, label: labels[0], sig: signatureData?.firma_entrega_base64, name: signatureData?.firma_entrega_nombre, cedula: signatureData?.firma_entrega_cedula },
    ])
  } else if (hasTercero) {
    drawCols([
      { x: 17, endX: 72, cx: 44.5, label: labels[0], sig: signatureData?.firma_entrega_base64, name: signatureData?.firma_entrega_nombre, cedula: signatureData?.firma_entrega_cedula },
      { x: 76, endX: 133, cx: 104.5, label: labels[1], sig: signatureData?.firma_recibe_base64, name: signatureData?.firma_recibe_nombre, cedula: signatureData?.firma_recibe_cedula },
      { x: 137, endX: 193, cx: 165, label: labels[2], sig: signatureData?.firma_tercero_base64, name: signatureData?.firma_tercero_nombre, cedula: signatureData?.firma_tercero_cedula },
    ])
  } else {
    drawCols([
      { x: 22, endX: 88, cx: 55, label: labels[0], sig: signatureData?.firma_entrega_base64, name: signatureData?.firma_entrega_nombre, cedula: signatureData?.firma_entrega_cedula },
      { x: 118, endX: 188, cx: 153, label: labels[1], sig: signatureData?.firma_recibe_base64, name: signatureData?.firma_recibe_nombre, cedula: signatureData?.firma_recibe_cedula },
    ])
  }
}

/**
 * Footer corporativo: línea fina + texto en gris elegante.
 */
export function drawFooter(doc: jsPDF, _accent: RGB): void {
  const pw = 210
  const ph = doc.internal.pageSize.height

  // Línea fina separadora
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.4)
  doc.line(12, ph - 12, pw - 12, ph - 12)

  // Texto principal del footer
  doc.setTextColor(...C.medium)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.text('GRUPO EMPRESARIAL SANTACRUZ', 14, ph - 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.setTextColor(...C.muted)
  doc.text('Sistema de Gestión de Canastillas  |  Barranquilla, Atlántico', 14, ph - 5)

  // Fecha de generación a la derecha
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.muted)
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, pw - 14, ph - 5, { align: 'right' })

  // Texto de confidencialidad
  doc.setFontSize(5)
  doc.setTextColor(...C.borderLight)
  doc.text('Documento confidencial — Uso exclusivo interno', 105, ph - 2, { align: 'center' })
}

/** Estilo tablas corporativo: header oscuro de acento, bordes finos, filas alternas sutiles */
export function tableStyles(accent: RGB) {
  return {
    styles: {
      fontSize: 8,
      cellPadding: 4,
      lineColor: [...C.border] as RGB,
      lineWidth: 0.25,
      textColor: [...C.darkGray] as RGB,
    },
    headStyles: {
      fillColor: [...accent] as RGB,
      textColor: [255, 255, 255] as RGB,
      fontStyle: 'bold' as const,
      fontSize: 7.5,
      halign: 'center' as const,
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [...C.light] as RGB,
    },
  }
}
