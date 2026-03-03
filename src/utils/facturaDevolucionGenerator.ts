import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Rental, RentalReturn, Canastilla } from '@/types'

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

interface FacturaData {
  rental: Rental
  returnData: {
    invoiceNumber: string
    returnDate: string
    daysCharged: number
    amount: number
    notes?: string
    canastillas: Canastilla[]
  }
  isPartial: boolean
  pendingCount: number
}

export const generateFacturaDevolucionPDF = async (data: FacturaData) => {
  const doc = new jsPDF()
  const { rental, returnData, isPartial, pendingCount } = data

  // Paleta de colores
  const black: [number, number, number] = [0, 0, 0]
  const darkGray: [number, number, number] = [51, 51, 51]
  const mediumGray: [number, number, number] = [102, 102, 102]
  const lightGray: [number, number, number] = [242, 242, 242]
  const borderGray: [number, number, number] = [217, 217, 217]
  const accentGreen: [number, number, number] = [34, 197, 94] // Verde para facturas

  const pageHeight = doc.internal.pageSize.height

  // ============================================
  // HEADER EMPRESARIAL
  // ============================================

  // Línea superior de acento
  doc.setFillColor(...accentGreen)
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

  // Cuadro de factura
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(1)
  doc.rect(140, 10, 55, 35)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...accentGreen)
  const tipoDoc = isPartial ? 'FACTURA PARCIAL' : 'FACTURA'
  doc.text(tipoDoc, 167.5, 18, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text(returnData.invoiceNumber, 167.5, 28, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  const fechaFactura = new Date(returnData.returnDate).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  doc.text(`Fecha: ${fechaFactura}`, 167.5, 38, { align: 'center' })

  // Línea divisoria
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, 50, 195, 50)

  // ============================================
  // INFORMACIÓN DEL CLIENTE
  // ============================================
  let yPos = 60

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('FACTURAR A:', 15, yPos)

  yPos += 2
  doc.setDrawColor(...accentGreen)
  doc.setLineWidth(2)
  doc.line(15, yPos, 50, yPos)

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
  ]

  if (rental.sale_point?.identification) {
    clientInfo.push(`NIT/CC: ${rental.sale_point.identification}`)
  }

  clientInfo.forEach((info) => {
    doc.text(info, 15, yPos)
    yPos += 5
  })

  // ============================================
  // INFORMACIÓN DEL ALQUILER
  // ============================================
  yPos += 5

  // Referencia del alquiler original
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('REFERENCIA ALQUILER:', 115, 60)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text(`Remisión: ${rental.remision_number || 'N/A'}`, 115, 67)
  doc.text(`Fecha inicio: ${new Date(rental.start_date).toLocaleDateString('es-CO')}`, 115, 72)
  doc.text(`Tipo: ${rental.rental_type}`, 115, 77)

  if (isPartial) {
    doc.setTextColor(234, 88, 12) // Naranja
    doc.setFont('helvetica', 'bold')
    doc.text(`Pendientes: ${pendingCount} canastillas`, 115, 84)
  }

  // ============================================
  // CANASTILLAS DEVUELTAS
  // ============================================
  yPos += 5

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('CANASTILLAS DEVUELTAS', 15, yPos)

  yPos += 2
  doc.setDrawColor(...accentGreen)
  doc.setLineWidth(2)
  doc.line(15, yPos, 75, yPos)

  yPos += 8

  // Agrupar canastillas por tamaño, color, forma y condición
  type CanastillaGroup = { size: string; color: string; shape: string; condition: string; count: number }
  const groupedCanastillas: Record<string, CanastillaGroup> = {}

  for (const item of returnData.canastillas) {
    const size = item.size || 'N/A'
    const color = item.color || 'N/A'
    const shape = item.shape || '-'
    const condition = item.condition || 'N/A'
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
      fillColor: [...accentGreen],
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

  yPos = (doc as any).lastAutoTable.finalY + 15

  // ============================================
  // RESUMEN DE FACTURACIÓN
  // ============================================

  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, yPos, 195, yPos)

  yPos += 10

  const rightX = 195
  const labelX = 115

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)

  // Canastillas devueltas
  doc.text('Canastillas devueltas:', labelX, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text(`${returnData.canastillas.length} unidades`, rightX, yPos, { align: 'right' })

  yPos += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)

  // Días facturados
  doc.text('Días facturados:', labelX, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  const diasText = returnData.daysCharged === 1 ? '1 día' : `${returnData.daysCharged} días`
  doc.text(diasText, rightX, yPos, { align: 'right' })

  yPos += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)

  // Tarifa diaria
  doc.text('Tarifa por canastilla/día:', labelX, yPos)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text(`$${rental.daily_rate.toLocaleString('es-CO')}`, rightX, yPos, { align: 'right' })

  yPos += 10

  // Cuadro del total
  doc.setDrawColor(...accentGreen)
  doc.setLineWidth(2)
  doc.rect(115, yPos - 3, 80, 14)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('TOTAL A PAGAR:', labelX + 5, yPos + 5)

  doc.setFontSize(14)
  doc.setTextColor(...accentGreen)
  const totalText = `$${returnData.amount.toLocaleString('es-CO')} COP`
  doc.text(totalText, rightX - 5, yPos + 5, { align: 'right' })

  // ============================================
  // NOTAS
  // ============================================

  if (returnData.notes) {
    yPos += 25

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...darkGray)
    doc.text('OBSERVACIONES:', 15, yPos)

    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    doc.setFontSize(8)

    const lines = doc.splitTextToSize(returnData.notes, 175)
    lines.forEach((line: string) => {
      doc.text(line, 15, yPos)
      yPos += 4
    })
  }

  // Mensaje de devolución parcial
  if (isPartial) {
    yPos += 25  // Más espacio después del total
    doc.setFillColor(254, 243, 199) // Amarillo claro
    doc.rect(15, yPos, 180, 12, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 83, 9) // Naranja oscuro
    doc.text('NOTA: Esta es una factura parcial. El alquiler permanece activo con', 20, yPos + 5)
    doc.text(`${pendingCount} canastillas pendientes de devolución.`, 20, yPos + 10)
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
  doc.text('CLIENTE', col1X, firmaY + 5, { align: 'center' })

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
  doc.text('EMPRESA', col2X, firmaY + 5, { align: 'center' })

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
  const docText = `Factura generada: ${new Date().toLocaleString('es-CO')}`
  const docWidth = doc.getTextWidth(docText)
  doc.text(docText, (210 - docWidth) / 2, pageHeight - 8)

  return doc
}

export const downloadFacturaDevolucionPDF = async (data: FacturaData) => {
  const doc = await generateFacturaDevolucionPDF(data)
  const fileName = `Factura_${data.returnData.invoiceNumber}.pdf`
  doc.save(fileName)
}

export const openFacturaDevolucionPDF = async (data: FacturaData) => {
  const doc = await generateFacturaDevolucionPDF(data)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}
