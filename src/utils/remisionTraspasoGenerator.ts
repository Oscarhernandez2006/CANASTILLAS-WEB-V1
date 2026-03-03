import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Transfer } from '@/types'

// Función para convertir imagen a base64
const getBase64FromUrl = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error loading image:', error)
    throw error
  }
}

export const generateRemisionTraspasoPDF = async (transfer: Transfer) => {
  const doc = new jsPDF()

  // Detectar si es un traspaso de lavado
  const isWashingTransfer = transfer.is_washing_transfer || false

  // Paleta de colores
  const black: [number, number, number] = [0, 0, 0]
  const darkGray: [number, number, number] = [51, 51, 51]
  const mediumGray: [number, number, number] = [102, 102, 102]
  const lightGray: [number, number, number] = [242, 242, 242]
  const borderGray: [number, number, number] = [217, 217, 217]
  const accentPurple: [number, number, number] = [139, 92, 246] // Violeta para traspasos
  const accentCyan: [number, number, number] = [6, 182, 212] // Cyan para lavado

  // Color de acento según tipo de traspaso
  const accentColor = isWashingTransfer ? accentCyan : accentPurple

  const pageHeight = doc.internal.pageSize.height

  // ============================================
  // HEADER EMPRESARIAL
  // ============================================

  // Línea superior de acento
  doc.setFillColor(...accentColor)
  doc.rect(0, 0, 210, 2, 'F')

  // Cargar logo
  let logoLoaded = false
  try {
    let logoBase64: string | null = null
    const logoPaths = [
      `${window.location.origin}/logo.png`,
      '/logo.png',
      './logo.png'
    ]

    for (const path of logoPaths) {
      try {
        logoBase64 = await getBase64FromUrl(path)
        break
      } catch (e) {
        continue
      }
    }

    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 15, 10, 30, 30)
      logoLoaded = true
    }
  } catch (error) {
    console.error('Error loading logo:', error)
  }

  // Información de la empresa
  const companyX = logoLoaded ? 50 : 15
  doc.setTextColor(...darkGray)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('SANTACRUZ', companyX, 20)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text('Sistema de Gestión de Canastillas', companyX, 27)
  doc.text('Barranquilla, Atlántico - Colombia', companyX, 32)
  doc.text('Tel: +57 311 758 0698', companyX, 37)

  // Cuadro de remisión
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(1)
  doc.rect(140, 10, 55, 35)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...accentColor)
  const tituloRemision = isWashingTransfer ? 'REMISIÓN LAVADO' : 'REMISIÓN TRASPASO'
  doc.text(tituloRemision, 167.5, 18, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text(transfer.remision_number || '', 167.5, 28, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  // Usar la fecha de generación de remisión, o la fecha de solicitud si no está aprobado aún
  const fechaRemision = transfer.remision_generated_at
    ? new Date(transfer.remision_generated_at).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : new Date(transfer.requested_at).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
  doc.text(`Fecha: ${fechaRemision}`, 167.5, 38, { align: 'center' })

  // Línea divisoria
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, 50, 195, 50)

  // ============================================
  // INFORMACIÓN DE USUARIOS
  // ============================================
  let yPos = 60

  // Usuario que entrega (columna izquierda)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('ENTREGA:', 15, yPos)

  yPos += 2
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(2)
  doc.line(15, yPos, 45, yPos)

  yPos += 8

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(`${transfer.from_user?.first_name || ''} ${transfer.from_user?.last_name || ''}`, 15, yPos)

  yPos += 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text(`Email: ${transfer.from_user?.email || ''}`, 15, yPos)

  if (transfer.from_user?.department) {
    yPos += 5
    doc.text(`Departamento: ${transfer.from_user.department}`, 15, yPos)
  }

  if (transfer.from_user?.area) {
    yPos += 5
    doc.text(`Área: ${transfer.from_user.area}`, 15, yPos)
  }

  // Usuario que recibe (columna derecha)
  let rightYPos = 60

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('RECIBE:', 115, rightYPos)

  rightYPos += 2
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(2)
  doc.line(115, rightYPos, 145, rightYPos)

  rightYPos += 8

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(`${transfer.to_user?.first_name || ''} ${transfer.to_user?.last_name || ''}`, 115, rightYPos)

  rightYPos += 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text(`Email: ${transfer.to_user?.email || ''}`, 115, rightYPos)

  if (transfer.to_user?.department) {
    rightYPos += 5
    doc.text(`Departamento: ${transfer.to_user.department}`, 115, rightYPos)
  }

  if (transfer.to_user?.area) {
    rightYPos += 5
    doc.text(`Área: ${transfer.to_user.area}`, 115, rightYPos)
  }

  yPos = Math.max(yPos, rightYPos) + 15

  // ============================================
  // CANASTILLAS
  // ============================================

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  const tituloCanastillas = isWashingTransfer ? 'CANASTILLAS ENVIADAS A LAVADO' : 'CANASTILLAS TRASPASADAS'
  doc.text(tituloCanastillas, 15, yPos)

  yPos += 2
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(2)
  doc.line(15, yPos, isWashingTransfer ? 90 : 75, yPos)

  yPos += 8

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
    theme: 'striped',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [...borderGray],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...accentColor],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: {
      textColor: [...darkGray],
    },
    alternateRowStyles: {
      fillColor: [...lightGray],
    },
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

  // ============================================
  // RESUMEN
  // ============================================

  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, yPos, 195, yPos)

  yPos += 8

  const totalCanastillas = transfer.transfer_items?.length || 0

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text('Total de canastillas:', 130, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(`${totalCanastillas} unidades`, 195, yPos, { align: 'right' })

  yPos += 8
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text('Fecha de solicitud:', 130, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  const fechaSolicitud = new Date(transfer.requested_at).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
  doc.text(fechaSolicitud, 195, yPos, { align: 'right' })

  // ============================================
  // NOTAS
  // ============================================

  if (transfer.notes) {
    yPos += 15

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...darkGray)
    doc.text('OBSERVACIONES:', 15, yPos)

    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    doc.setFontSize(8)

    const lines = doc.splitTextToSize(transfer.notes, 175)
    lines.forEach((line: string) => {
      doc.text(line, 15, yPos)
      yPos += 4
    })
  }

  // ============================================
  // SECCIÓN DE FIRMAS
  // ============================================

  const firmasY = pageHeight - 50

  // Línea divisoria
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, firmasY, 195, firmasY)

  // Título de firmas
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('FIRMAS DE CONFORMIDAD', 105, firmasY + 7, { align: 'center' })

  // Columna: ENTREGA
  const col1X = 50
  let firmaY = firmasY + 20

  doc.setDrawColor(...darkGray)
  doc.setLineWidth(0.5)
  doc.line(20, firmaY, 80, firmaY)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('ENTREGA', col1X, firmaY + 5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...mediumGray)
  doc.text('Nombre:', 20, firmaY + 10)
  doc.text('Cédula:', 20, firmaY + 15)

  // Columna: RECIBE
  const col2X = 160

  doc.setDrawColor(...darkGray)
  doc.setLineWidth(0.5)
  doc.line(130, firmaY, 190, firmaY)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('RECIBE', col2X, firmaY + 5, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...mediumGray)
  doc.text('Nombre:', 130, firmaY + 10)
  doc.text('Cédula:', 130, firmaY + 15)

  // ============================================
  // FOOTER
  // ============================================

  doc.setFontSize(7)
  doc.setTextColor(180, 180, 180)
  const docText = `Documento generado: ${new Date().toLocaleString('es-CO')}`
  const docWidth = doc.getTextWidth(docText)
  doc.text(docText, (210 - docWidth) / 2, pageHeight - 8)

  return doc
}

export const downloadRemisionTraspasoPDF = async (transfer: Transfer) => {
  const doc = await generateRemisionTraspasoPDF(transfer)
  const tipoRemision = transfer.is_washing_transfer ? 'Lavado' : 'Traspaso'
  const fileName = `Remision_${tipoRemision}_${transfer.remision_number}.pdf`
  doc.save(fileName)
}

export const openRemisionTraspasoPDF = async (transfer: Transfer) => {
  const doc = await generateRemisionTraspasoPDF(transfer)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}
