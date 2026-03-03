import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { WashingOrder } from '@/types'
import { calculateOrderTimes } from '@/services/washingService'

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

export const generateRemisionLavadoPDF = async (
  order: WashingOrder,
  tipo: 'ENTREGA' | 'DEVOLUCION'
) => {
  const doc = new jsPDF()

  // Paleta de colores
  const black: [number, number, number] = [0, 0, 0]
  const darkGray: [number, number, number] = [51, 51, 51]
  const mediumGray: [number, number, number] = [102, 102, 102]
  const lightGray: [number, number, number] = [242, 242, 242]
  const borderGray: [number, number, number] = [217, 217, 217]
  const accentBlue: [number, number, number] = tipo === 'ENTREGA' ? [59, 130, 246] : [20, 184, 166] // Azul para entrega, Teal para devolución

  const pageHeight = doc.internal.pageSize.height
  const remisionNumber = tipo === 'ENTREGA' ? order.remision_entrega_number : order.remision_devolucion_number

  // ============================================
  // HEADER EMPRESARIAL
  // ============================================

  // Línea superior de acento
  doc.setFillColor(...accentBlue)
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
  doc.setTextColor(...accentBlue)
  const tipoText = tipo === 'ENTREGA' ? 'REMISIÓN LAVADO' : 'REMISIÓN DEVOLUCIÓN'
  doc.text(tipoText, 167.5, 18, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text(remisionNumber || '', 167.5, 28, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  const fecha = tipo === 'ENTREGA' ? order.sent_at : order.delivered_at
  const fechaStr = fecha ? new Date(fecha).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) : ''
  doc.text(`Fecha: ${fechaStr}`, 167.5, 38, { align: 'center' })

  // Línea divisoria
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, 50, 195, 50)

  // ============================================
  // INFORMACIÓN DE USUARIOS
  // ============================================
  let yPos = 60

  // Usuario que envía
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text(tipo === 'ENTREGA' ? 'ENVIADO POR:' : 'DEVUELTO POR:', 15, yPos)

  yPos += 2
  doc.setDrawColor(...accentBlue)
  doc.setLineWidth(2)
  doc.line(15, yPos, 50, yPos)

  yPos += 8

  const userFrom = tipo === 'ENTREGA' ? order.sender_user : order.washing_staff
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(`${userFrom?.first_name || ''} ${userFrom?.last_name || ''}`, 15, yPos)

  yPos += 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text(`Email: ${userFrom?.email || ''}`, 15, yPos)

  // Usuario que recibe (columna derecha)
  let rightYPos = 60

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text(tipo === 'ENTREGA' ? 'RECIBE (LAVADO):' : 'RECIBE:', 115, rightYPos)

  rightYPos += 2
  doc.setDrawColor(...accentBlue)
  doc.setLineWidth(2)
  doc.line(115, rightYPos, 155, rightYPos)

  rightYPos += 8

  const userTo = tipo === 'ENTREGA' ? order.washing_staff : order.sender_user
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(`${userTo?.first_name || ''} ${userTo?.last_name || ''}`, 115, rightYPos)

  rightYPos += 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text(`Email: ${userTo?.email || ''}`, 115, rightYPos)

  yPos = Math.max(yPos, rightYPos) + 15

  // ============================================
  // CANASTILLAS
  // ============================================

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('CANASTILLAS', 15, yPos)

  yPos += 2
  doc.setDrawColor(...accentBlue)
  doc.setLineWidth(2)
  doc.line(15, yPos, 50, yPos)

  yPos += 8

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
    theme: 'striped',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [...borderGray],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...accentBlue],
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

  // ============================================
  // RESUMEN
  // ============================================

  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, yPos, 195, yPos)

  yPos += 8

  const totalCanastillas = order.washing_items?.length || 0

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text('Total de canastillas:', 130, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(`${totalCanastillas} unidades`, 195, yPos, { align: 'right' })

  // Si es devolución, mostrar tiempos
  if (tipo === 'DEVOLUCION') {
    const times = calculateOrderTimes(order)

    yPos += 8
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    doc.text('Tiempo de lavado:', 130, yPos)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...black)
    doc.text(`${times.washingTime || 0} horas`, 195, yPos, { align: 'right' })

    // Contar lavadas y dañadas
    const lavadas = order.washing_items?.filter(i => i.item_status === 'LAVADA').length || 0
    const danadas = order.washing_items?.filter(i => i.item_status === 'DANADA').length || 0

    yPos += 8
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    doc.text('Canastillas lavadas:', 130, yPos)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(34, 197, 94) // verde
    doc.text(`${lavadas}`, 195, yPos, { align: 'right' })

    if (danadas > 0) {
      yPos += 6
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...mediumGray)
      doc.text('Canastillas dañadas:', 130, yPos)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(239, 68, 68) // rojo
      doc.text(`${danadas}`, 195, yPos, { align: 'right' })
    }
  }

  // ============================================
  // NOTAS
  // ============================================

  if (order.notes) {
    yPos += 15

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...darkGray)
    doc.text('OBSERVACIONES:', 15, yPos)

    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    doc.setFontSize(8)

    const lines = doc.splitTextToSize(order.notes, 175)
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

export const downloadRemisionLavadoPDF = async (order: WashingOrder, tipo: 'ENTREGA' | 'DEVOLUCION') => {
  const doc = await generateRemisionLavadoPDF(order, tipo)
  const remisionNumber = tipo === 'ENTREGA' ? order.remision_entrega_number : order.remision_devolucion_number
  const fileName = `Remision_Lavado_${remisionNumber}.pdf`
  doc.save(fileName)
}

export const openRemisionLavadoPDF = async (order: WashingOrder, tipo: 'ENTREGA' | 'DEVOLUCION') => {
  const doc = await generateRemisionLavadoPDF(order, tipo)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}
