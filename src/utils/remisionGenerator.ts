import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Rental } from '@/types'

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

export const generateRemisionPDF = async (rental: Rental, remisionNumber: string) => {
  const doc = new jsPDF()
  
  // Paleta de colores empresarial profesional
  const black: [number, number, number] = [0, 0, 0]
  const darkGray: [number, number, number] = [51, 51, 51]
  const mediumGray: [number, number, number] = [102, 102, 102]
  const lightGray: [number, number, number] = [242, 242, 242]
  const borderGray: [number, number, number] = [217, 217, 217]
  const accentBlue: [number, number, number] = [41, 98, 255]
  
  const pageHeight = doc.internal.pageSize.height
  const marginBottom = 60 // Espacio para firmas
  
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
  doc.rect(140, 10, 55, 30)
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('REMISIÓN', 167.5, 18, { align: 'center' })
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(remisionNumber, 167.5, 26, { align: 'center' })
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  const entregaDate = new Date(rental.start_date).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  doc.text(`Fecha: ${entregaDate}`, 167.5, 34, { align: 'center' })
  
  // Línea divisoria
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, 45, 195, 45)
  
  // ============================================
  // INFORMACIÓN DEL CLIENTE
  // ============================================
  let yPos = 55
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('ENTREGAR A:', 15, yPos)
  
  yPos += 2
  doc.setDrawColor(...accentBlue)
  doc.setLineWidth(2)
  doc.line(15, yPos, 45, yPos)
  
  yPos += 8
  
  // Nombre del cliente
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text(rental.sale_point?.name || 'N/A', 15, yPos)
  
  // Badge de tipo
  const nameWidth = doc.getTextWidth(rental.sale_point?.name || 'N/A')
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.rect(17 + nameWidth, yPos - 3.5, 25, 5)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...mediumGray)
  const badgeText = rental.sale_point?.client_type === 'CLIENTE_EXTERNO' ? 'EXTERNO' : 'P. VENTA'
  doc.text(badgeText, 17 + nameWidth + 12.5, yPos - 0.5, { align: 'center' })
  
  yPos += 7
  
  // Detalles del cliente
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  
  const clientInfo = [
    `Contacto: ${rental.sale_point?.contact_name || 'N/A'}`,
    `Teléfono: ${rental.sale_point?.contact_phone || 'N/A'}`,
    `Dirección: ${rental.sale_point?.address || 'N/A'}`,
    `Ciudad: ${rental.sale_point?.city || 'N/A'}, ${rental.sale_point?.region || 'N/A'}`,
  ]
  
  if (rental.sale_point?.identification) {
    clientInfo.push(`NIT/CC: ${rental.sale_point.identification}`)
  }
  
  clientInfo.forEach((info) => {
    doc.text(info, 15, yPos)
    yPos += 5
  })
  
  // ============================================
  // CONDICIONES DEL ALQUILER
  // ============================================
  yPos += 5
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('CONDICIONES DEL ALQUILER', 15, yPos)
  
  yPos += 2
  doc.setDrawColor(...accentBlue)
  doc.setLineWidth(2)
  doc.line(15, yPos, 85, yPos)
  
  yPos += 10
  
  const startDate = new Date(rental.start_date).toLocaleDateString('es-CO')
  const estimatedReturnDate = rental.estimated_return_date 
    ? new Date(rental.estimated_return_date).toLocaleDateString('es-CO')
    : 'No especificada'
  const estimatedDays = rental.estimated_days || 0
  
  // Tabla de condiciones
  autoTable(doc, {
    startY: yPos,
    head: [['FECHA DE ENTREGA', 'FECHA ESTIMADA RETORNO', 'DÍAS ESTIMADOS']],
    body: [[startDate, estimatedReturnDate, `${estimatedDays} días`]],
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: [...darkGray],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [...mediumGray],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      fillColor: [...lightGray],
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 60 },
      2: { cellWidth: 60 },
    },
  })
  
  yPos = (doc as any).lastAutoTable.finalY + 10
  
  // ============================================
  // CANASTILLAS ENTREGADAS
  // ============================================
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('CANASTILLAS ENTREGADAS', 15, yPos)
  
  yPos += 2
  doc.setDrawColor(...accentBlue)
  doc.setLineWidth(2)
  doc.line(15, yPos, 80, yPos)
  
  yPos += 8

  // Agrupar canastillas por tamaño, color, forma y condición
  type CanastillaGroup = { size: string; color: string; shape: string; condition: string; count: number }
  const groupedCanastillas: Record<string, CanastillaGroup> = {}

  for (const item of rental.rental_items || []) {
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

  const canastillas = Object.values(groupedCanastillas).map((group, index) => [
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
    body: canastillas,
    theme: 'striped',
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [...borderGray],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [...darkGray],
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
  
  yPos = (doc as any).lastAutoTable.finalY + 12
  
  // ============================================
  // VALORES DEL ALQUILER
  // ============================================
  
  const canastillasCount = rental.rental_items?.length || 0
  const dailyRate = rental.daily_rate
  const estimatedTotal = estimatedDays > 0 ? canastillasCount * dailyRate * estimatedDays : 0
  
  // Verificar si necesitamos nueva página
  if (yPos > pageHeight - marginBottom - 50) {
    doc.addPage()
    yPos = 20
  }
  
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, yPos, 195, yPos)
  
  yPos += 8
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  
  const rightX = 195
  const labelX = 115
  
  doc.text('Cantidad de canastillas:', labelX, yPos)
  doc.text(`${canastillasCount} unidades`, rightX, yPos, { align: 'right' })
  yPos += 5
  
  doc.text('Tarifa diaria por canastilla:', labelX, yPos)
  doc.text(`$${dailyRate.toLocaleString('es-CO')}`, rightX, yPos, { align: 'right' })
  yPos += 5
  
  doc.text('Días estimados:', labelX, yPos)
  doc.text(`${estimatedDays} días`, rightX, yPos, { align: 'right' })
  yPos += 8
  
  // Cuadro del total estimado
  doc.setDrawColor(...darkGray)
  doc.setLineWidth(1.5)
  doc.rect(115, yPos - 3, 80, 12)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text('TOTAL ESTIMADO:', labelX + 5, yPos + 5)
  
  doc.setFontSize(14)
  const totalText = `$${estimatedTotal.toLocaleString('es-CO')} COP`
  doc.text(totalText, rightX - 5, yPos + 5, { align: 'right' })
  
  yPos += 18
  
  // ============================================
  // OBSERVACIONES
  // ============================================
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('OBSERVACIONES:', 15, yPos)
  
  yPos += 4
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.setFontSize(7)
  
  const observaciones = [
    '• El valor final se calculará según los días reales de uso.',
    '• Las canastillas deben devolverse en las mismas condiciones.',
    '• El cliente es responsable de cualquier daño o pérdida.',
  ]
  
  observaciones.forEach((obs) => {
    doc.text(obs, 15, yPos)
    yPos += 4
  })
  
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
  doc.text('FIRMAS', 105, firmasY + 7, { align: 'center' })
  
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
  const docText = `Remisión generada: ${new Date().toLocaleString('es-CO')}`
  const docWidth = doc.getTextWidth(docText)
  doc.text(docText, (210 - docWidth) / 2, pageHeight - 8)
  
  return doc
}

export const downloadRemisionPDF = async (rental: Rental, remisionNumber: string) => {
  const doc = await generateRemisionPDF(rental, remisionNumber)
  const fileName = `Remision_${remisionNumber}.pdf`
  doc.save(fileName)
}

export const openRemisionPDF = async (rental: Rental, remisionNumber: string) => {
  const doc = await generateRemisionPDF(rental, remisionNumber)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}