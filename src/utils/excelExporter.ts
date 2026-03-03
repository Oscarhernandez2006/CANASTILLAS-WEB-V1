import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

interface ReportData {
  title: string
  subtitle?: string
  headers: string[]
  data: any[][]
  summary?: { label: string; value: string | number }[]
}

export const exportToExcel = (reportData: ReportData, filename: string) => {
  // Crear un nuevo workbook
  const wb = XLSX.utils.book_new()

  // Preparar los datos
  const wsData: any[][] = []

  // Título
  wsData.push([reportData.title])
  wsData.push([]) // Línea en blanco

  // Subtítulo si existe
  if (reportData.subtitle) {
    wsData.push([reportData.subtitle])
    wsData.push([])
  }

  // Fecha de generación
  wsData.push(['Fecha de generación:', new Date().toLocaleString('es-CO')])
  wsData.push([])

  // Headers
  wsData.push(reportData.headers)

  // Datos
  reportData.data.forEach(row => {
    wsData.push(row)
  })

  // Resumen si existe
  if (reportData.summary && reportData.summary.length > 0) {
    wsData.push([])
    wsData.push(['RESUMEN'])
    reportData.summary.forEach(item => {
      wsData.push([item.label, item.value])
    })
  }

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Configurar ancho de columnas
  const colWidths = reportData.headers.map((_, idx) => {
    const maxLength = Math.max(
      reportData.headers[idx]?.length || 10,
      ...reportData.data.map(row => String(row[idx] || '').length)
    )
    return { wch: Math.min(maxLength + 2, 50) }
  })
  ws['!cols'] = colWidths

  // Estilo para el título (merge cells)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: reportData.headers.length - 1 } }
  ]

  // Agregar worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')

  // Generar archivo
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const data = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  })
  
  saveAs(data, `${filename}_${new Date().getTime()}.xlsx`)
}

// Exportar datos de gráficas
export const exportChartToExcel = (
  title: string,
  labels: string[],
  datasets: { name: string; data: number[] }[],
  filename: string
) => {
  const wb = XLSX.utils.book_new()
  const wsData: any[][] = []

  // Título
  wsData.push([title])
  wsData.push([])
  wsData.push(['Fecha de generación:', new Date().toLocaleString('es-CO')])
  wsData.push([])

  // Headers: primera columna vacía para labels, luego nombres de datasets
  const headers = ['', ...datasets.map(d => d.name)]
  wsData.push(headers)

  // Datos: cada fila es un label con sus valores
  labels.forEach((label, idx) => {
    const row = [label, ...datasets.map(d => d.data[idx] || 0)]
    wsData.push(row)
  })

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 30 },
    ...datasets.map(() => ({ wch: 15 }))
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Datos')

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const data = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  })
  
  saveAs(data, `${filename}_${new Date().getTime()}.xlsx`)
}