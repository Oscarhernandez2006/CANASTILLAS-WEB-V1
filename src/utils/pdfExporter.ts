import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ReportData {
  title: string
  subtitle?: string
  headers: string[]
  data: any[][]
  summary?: { label: string; value: string | number }[]
}

const darkGray: [number, number, number] = [51, 51, 51]
const mediumGray: [number, number, number] = [102, 102, 102]
const lightGray: [number, number, number] = [242, 242, 242]
const borderGray: [number, number, number] = [217, 217, 217]
const accentBlue: [number, number, number] = [41, 98, 255]

export const exportToPDF = async (reportData: ReportData, filename: string) => {
  const doc = new jsPDF()
  let yPos = 20

  // Línea superior de acento
  doc.setFillColor(...accentBlue)
  doc.rect(0, 0, 210, 2, 'F')

  // Logo (intentar cargar)
  try {
    const logoBase64 = await getBase64FromUrl('/logo.png')
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 15, 10, 25, 25)
    }
  } catch (error) {
    console.log('Logo no disponible')
  }

  // Información de la empresa
  doc.setTextColor(...darkGray)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('SANTACRUZ', 45, 20)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text('Sistema de Gestión de Canastillas', 45, 27)
  doc.text('Barranquilla, Atlántico - Colombia', 45, 32)

  // Fecha de generación
  doc.setFontSize(8)
  doc.setTextColor(...mediumGray)
  const fechaGen = new Date().toLocaleString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  doc.text(`Generado: ${fechaGen}`, 195, 20, { align: 'right' })

  // Línea divisoria
  yPos = 45
  doc.setDrawColor(...borderGray)
  doc.setLineWidth(0.5)
  doc.line(15, yPos, 195, yPos)

  yPos += 10

  // Título del reporte
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text(reportData.title, 105, yPos, { align: 'center' })

  yPos += 8

  // Subtítulo si existe
  if (reportData.subtitle) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    doc.text(reportData.subtitle, 105, yPos, { align: 'center' })
    yPos += 8
  }

  yPos += 5

  // Tabla principal
  autoTable(doc, {
    startY: yPos,
    head: [reportData.headers],
    body: reportData.data,
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
  })

  yPos = (doc as any).lastAutoTable.finalY + 15

  // Resumen si existe
  if (reportData.summary && reportData.summary.length > 0) {
    const pageHeight = doc.internal.pageSize.height

    // Verificar si necesitamos nueva página
    if (yPos > pageHeight - 60) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...darkGray)
    doc.text('RESUMEN', 15, yPos)

    yPos += 2
    doc.setDrawColor(...accentBlue)
    doc.setLineWidth(2)
    doc.line(15, yPos, 45, yPos)

    yPos += 8

    autoTable(doc, {
      startY: yPos,
      head: [['Concepto', 'Valor']],
      body: reportData.summary.map(item => [item.label, item.value]),
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [...mediumGray],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontStyle: 'bold',
        fontSize: 10,
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 80, halign: 'right', fontStyle: 'bold' },
      },
    })
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text(
      `Página ${i} de ${pageCount}`,
      105,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    )
  }

  // Guardar
  doc.save(`${filename}_${new Date().getTime()}.pdf`)
}

// Función auxiliar para cargar imagen
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
    throw error
  }
}

// Exportar gráfica a PDF
export const exportChartToPDF = async (
  title: string,
  chartImageBase64: string,
  labels: string[],
  datasets: { name: string; data: number[] }[],
  filename: string
) => {
  const doc = new jsPDF()

  // Header similar al reporte
  doc.setFillColor(...accentBlue)
  doc.rect(0, 0, 210, 2, 'F')

  doc.setTextColor(...darkGray)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('SANTACRUZ', 15, 20)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text('Sistema de Gestión de Canastillas', 15, 27)

  // Título
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkGray)
  doc.text(title, 105, 45, { align: 'center' })

  // Imagen de la gráfica
  doc.addImage(chartImageBase64, 'PNG', 15, 55, 180, 100)

  // Tabla de datos
  const tableData = labels.map((label, idx) => [
    label,
    ...datasets.map(d => d.data[idx] || 0)
  ])

  autoTable(doc, {
    startY: 165,
    head: [['Categoría', ...datasets.map(d => d.name)]],
    body: tableData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: {
      fillColor: [...darkGray],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [...lightGray],
    },
  })

  doc.save(`${filename}_${new Date().getTime()}.pdf`)
}