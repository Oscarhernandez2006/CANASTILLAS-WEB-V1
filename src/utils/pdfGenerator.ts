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

export const generateInvoicePDF = async (rental: Rental) => {
  const doc = new jsPDF()
  
  // Paleta de colores empresarial profesional
  const black: [number, number, number] = [0, 0, 0]
  const darkGray: [number, number, number] = [51, 51, 51]
  const mediumGray: [number, number, number] = [102, 102, 102]
  const lightGray: [number, number, number] = [242, 242, 242]
  const borderGray: [number, number, number] = [217, 217, 217]
  const accentBlue: [number, number, number] = [41, 98, 255]
  
  const pageHeight = doc.internal.pageSize.height
  const marginBottom = 45 // Espacio reservado para el footer
  
  // ============================================
  // HEADER EMPRESARIAL MINIMALISTA
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
  
  // Información de la empresa (lado izquierdo)
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
  
  // Cuadro de factura minimalista (lado derecho)
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(1)
  doc.rect(140, 10, 55, 30)
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('FACTURA', 167.5, 18, { align: 'center' })
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(rental.invoice_number || 'N/A', 167.5, 26, { align: 'center' })
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  const invoiceDate = new Date(rental.actual_return_date || new Date()).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  doc.text(`Fecha: ${invoiceDate}`, 167.5, 34, { align: 'center' })
  
  // Línea divisoria del header
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
  doc.text('FACTURAR A:', 15, yPos)
  
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
  // DETALLES DEL SERVICIO
  // ============================================
  yPos += 5
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('DETALLES DEL SERVICIO', 15, yPos)
  
  yPos += 2
  doc.setDrawColor(...accentBlue)
  doc.setLineWidth(2)
  doc.line(15, yPos, 70, yPos)
  
  yPos += 10
  
  const startDate = new Date(rental.start_date).toLocaleDateString('es-CO')
  const endDate = new Date(rental.actual_return_date || new Date()).toLocaleDateString('es-CO')
  const actualDays = rental.actual_days || 0
  const diasText = actualDays === 1 ? '1 día' : `${actualDays} días`

  // Tabla de fechas minimalista
  autoTable(doc, {
    startY: yPos,
    head: [['FECHA DE SALIDA', 'FECHA DE RETORNO', 'DÍAS DE ALQUILER']],
    body: [[startDate, endDate, diasText]],
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
  
  yPos = (doc as any).lastAutoTable.finalY + 5
  
  // Advertencia de exceso (si aplica)
  if (rental.estimated_days && actualDays > rental.estimated_days) {
    doc.setDrawColor(...borderGray)
    doc.rect(15, yPos, 180, 8)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    doc.text(`⚠ Nota: Excedió ${actualDays - rental.estimated_days} día(s) del período estimado (${rental.estimated_days} días)`, 20, yPos + 5)
    yPos += 10
  }
  
  // ============================================
  // CANASTILLAS ALQUILADAS
  // ============================================
  yPos += 5
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('CANASTILLAS ALQUILADAS', 15, yPos)
  
  yPos += 2
  doc.setDrawColor(...accentBlue)
  doc.setLineWidth(2)
  doc.line(15, yPos, 80, yPos)
  
  yPos += 8

  // Agrupar canastillas por tamaño y color
  const groupedCanastillas = (rental.rental_items || []).reduce((acc, item) => {
    const key = `${item.canastilla.size}-${item.canastilla.color}`
    if (!acc[key]) {
      acc[key] = {
        size: item.canastilla.size,
        color: item.canastilla.color,
        count: 0
      }
    }
    acc[key].count++
    return acc
  }, {} as Record<string, { size: string; color: string; count: number }>)

  const canastillas = Object.values(groupedCanastillas).map((group, index) => [
    (index + 1).toString(),
    `${group.size} ${group.color}`,
    group.count.toString(),
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'DESCRIPCIÓN', 'CANTIDAD']],
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
      1: { cellWidth: 133, fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
    },
  })
  
  yPos = (doc as any).lastAutoTable.finalY + 12
  
  // ============================================
  // CÁLCULO Y TOTAL
  // ============================================
  
  const canastillasCount = rental.rental_items?.length || 0
  const dailyRate = rental.daily_rate
  const subtotal = canastillasCount * dailyRate * actualDays
  const total = rental.total_amount || subtotal
  
  // Verificar si necesitamos una nueva página
  if (yPos > pageHeight - marginBottom - 50) {
    doc.addPage()
    yPos = 20
  }
  
  // Línea divisoria antes del total
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, yPos, 195, yPos)
  
  yPos += 8
  
  // Desglose de cálculo (alineado a la derecha)
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
  
  doc.text('Días de alquiler:', labelX, yPos)
  doc.text(diasText, rightX, yPos, { align: 'right' })
  yPos += 5
  
  doc.text('Subtotal:', labelX, yPos)
  doc.text(`$${subtotal.toLocaleString('es-CO')}`, rightX, yPos, { align: 'right' })
  yPos += 8
  
  // Cuadro del total
  doc.setDrawColor(...black)
  doc.setLineWidth(1.5)
  doc.rect(115, yPos - 3, 80, 12)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...black)
  doc.text('TOTAL A PAGAR:', labelX + 5, yPos + 5)
  
  doc.setFontSize(14)
  const totalText = `$${total.toLocaleString('es-CO')} COP`
  doc.text(totalText, rightX - 5, yPos + 5, { align: 'right' })
  
  yPos += 18
  
  // ============================================
  // TÉRMINOS Y CONDICIONES
  // ============================================
  
  // Verificar si necesitamos una nueva página para términos
  if (yPos > pageHeight - marginBottom - 30) {
    doc.addPage()
    yPos = 20
  }
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text('TÉRMINOS Y CONDICIONES:', 15, yPos)
  
  yPos += 5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.setFontSize(7)
  
  const terms = [
    '• Las canastillas deben ser devueltas en las mismas condiciones en que fueron entregadas.',
    '• El cliente es responsable por cualquier daño o pérdida de las canastillas durante el período de alquiler.',
    '• Este documento constituye un comprobante válido de la transacción.',
  ]
  
  terms.forEach((term) => {
    doc.text(term, 15, yPos)
    yPos += 4
  })
  
  // ============================================
  // FOOTER PROFESIONAL (FIJO EN LA PARTE INFERIOR)
  // ============================================
  
  // Función para dibujar el footer
  const drawFooter = (pageNum: number) => {
    const currentPage = pageNum
    doc.setPage(currentPage)
    
    let footerY = pageHeight - 27
    
    // Línea superior del footer
    doc.setDrawColor(...borderGray)
    doc.setLineWidth(0.5)
    doc.line(15, footerY, 195, footerY)
    
    footerY += 6
    
    // Mensaje de agradecimiento
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...darkGray)
    const thanksText = 'Gracias por su preferencia'
    const thanksWidth = doc.getTextWidth(thanksText)
    doc.text(thanksText, (210 - thanksWidth) / 2, footerY)
    
    footerY += 5
    
    // Información de contacto - LÍNEA 1
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    
    const line1 = 'SANTACRUZ - Sistema de Gestión de Canastillas'
    const line1Width = doc.getTextWidth(line1)
    doc.text(line1, (210 - line1Width) / 2, footerY)
    
    footerY += 4
    
    // Información de contacto - LÍNEA 2
    const line2 = 'Barranquilla, Atlántico - Colombia | Tel: +57 311 758 0698'
    const line2Width = doc.getTextWidth(line2)
    doc.text(line2, (210 - line2Width) / 2, footerY)
    
    footerY += 5
    
    // Marca de agua con fecha de generación
    doc.setFontSize(6)
    doc.setTextColor(180, 180, 180)
    const docText = `Documento generado: ${new Date().toLocaleString('es-CO')}`
    const docWidth = doc.getTextWidth(docText)
    doc.text(docText, (210 - docWidth) / 2, footerY)
  }
  
  // Dibujar footer en todas las páginas
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    drawFooter(i)
  }
  
  return doc
}

export const downloadInvoicePDF = async (rental: Rental) => {
  const doc = await generateInvoicePDF(rental)
  const fileName = `Factura_${rental.invoice_number || 'Sin_Numero'}.pdf`
  doc.save(fileName)
}

export const openInvoicePDF = async (rental: Rental) => {
  const doc = await generateInvoicePDF(rental)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  window.open(pdfUrl, '_blank')
}