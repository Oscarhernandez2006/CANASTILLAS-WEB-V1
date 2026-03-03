import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { supabase } from '@/lib/supabase'
import XLSX from 'xlsx-js-style'
import { saveAs } from 'file-saver'
import { usePermissions } from '@/hooks/usePermissions'
import type { PermissionKey } from '@/types'

type ReportType =
  | 'inventario'
  | 'alquileres'
  | 'traspasos'
  | 'clientes'
  | 'usuarios'
  | 'ingresos'
  | 'canastillas_alquiladas'
  | 'clientes_frecuentes'

interface ReportOption {
  id: ReportType
  name: string
  description: string
  icon: React.ReactNode
  requiresDateRange: boolean
  permissionKey: PermissionKey
}

// Estilos profesionales para Excel
const excelStyles = {
  companyTitle: {
    font: { bold: true, sz: 18, color: { rgb: '166534' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  subtitle: {
    font: { sz: 12, color: { rgb: '6B7280' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  reportTitle: {
    font: { bold: true, sz: 14, color: { rgb: '111827' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: 'F3F4F6' } },
  },
  dateInfo: {
    font: { sz: 10, italic: true, color: { rgb: '6B7280' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  },
  header: {
    font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '16A34A' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '166534' } },
      bottom: { style: 'thin', color: { rgb: '166534' } },
      left: { style: 'thin', color: { rgb: '166534' } },
      right: { style: 'thin', color: { rgb: '166534' } },
    },
  },
  dataCell: {
    font: { sz: 10 },
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    },
  },
  dataCellAlt: {
    font: { sz: 10 },
    alignment: { vertical: 'center' },
    fill: { fgColor: { rgb: 'F9FAFB' } },
    border: {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    },
  },
  currency: {
    numFmt: '"$"#,##0',
  },
  summaryTitle: {
    font: { bold: true, sz: 12, color: { rgb: '166534' } },
    fill: { fgColor: { rgb: 'DCFCE7' } },
    border: {
      top: { style: 'medium', color: { rgb: '16A34A' } },
      bottom: { style: 'thin', color: { rgb: '16A34A' } },
      left: { style: 'thin', color: { rgb: '16A34A' } },
      right: { style: 'thin', color: { rgb: '16A34A' } },
    },
  },
  summaryLabel: {
    font: { bold: true, sz: 10, color: { rgb: '374151' } },
    fill: { fgColor: { rgb: 'F0FDF4' } },
    border: {
      top: { style: 'thin', color: { rgb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
      left: { style: 'thin', color: { rgb: 'D1D5DB' } },
      right: { style: 'thin', color: { rgb: 'D1D5DB' } },
    },
  },
  summaryValue: {
    font: { bold: true, sz: 10, color: { rgb: '166534' } },
    fill: { fgColor: { rgb: 'F0FDF4' } },
    alignment: { horizontal: 'right' },
    border: {
      top: { style: 'thin', color: { rgb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
      left: { style: 'thin', color: { rgb: 'D1D5DB' } },
      right: { style: 'thin', color: { rgb: 'D1D5DB' } },
    },
  },
}

export function ReportesPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { hasPermission } = usePermissions()

  const allReportOptions: ReportOption[] = [
    {
      id: 'inventario',
      name: 'Inventario de Canastillas',
      description: 'Listado completo de todas las canastillas con su estado, ubicación y propietario',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      requiresDateRange: false,
      permissionKey: 'reportes.inventario',
    },
    {
      id: 'alquileres',
      name: 'Alquileres',
      description: 'Historial de alquileres con fechas, clientes, montos y estados',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      requiresDateRange: true,
      permissionKey: 'reportes.alquileres',
    },
    {
      id: 'traspasos',
      name: 'Traspasos',
      description: 'Historial de traspasos entre usuarios con estados y cantidades',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      requiresDateRange: true,
      permissionKey: 'reportes.traspasos',
    },
    {
      id: 'clientes',
      name: 'Clientes',
      description: 'Listado de clientes y puntos de venta con información de contacto',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      requiresDateRange: false,
      permissionKey: 'reportes.clientes',
    },
    {
      id: 'usuarios',
      name: 'Usuarios',
      description: 'Listado de usuarios del sistema con roles y estado',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      requiresDateRange: false,
      permissionKey: 'reportes.usuarios',
    },
    {
      id: 'ingresos',
      name: 'Reporte de Ingresos',
      description: 'Análisis de ingresos por período con totales y promedios',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      requiresDateRange: true,
      permissionKey: 'reportes.ingresos',
    },
    {
      id: 'canastillas_alquiladas',
      name: 'Canastillas Más Alquiladas',
      description: 'Top de canastillas con mayor número de alquileres e ingresos generados',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      requiresDateRange: true,
      permissionKey: 'reportes.canastillas_alquiladas',
    },
    {
      id: 'clientes_frecuentes',
      name: 'Clientes Frecuentes',
      description: 'Ranking de clientes por número de alquileres e ingresos generados',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      requiresDateRange: true,
      permissionKey: 'reportes.clientes_frecuentes',
    },
  ]

  // Filtrar reportes según permisos del usuario
  const reportOptions = allReportOptions.filter(option => hasPermission(option.permissionKey))

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Crear libro de Excel profesional con estilos
  const createStyledWorkbook = (
    title: string,
    headers: string[],
    data: any[][],
    columnWidths: number[],
    options?: {
      dateRange?: string
      summaryData?: { label: string; value: string | number }[]
      currencyColumns?: number[]
    }
  ) => {
    const wb = XLSX.utils.book_new()
    const colCount = headers.length

    // Crear array de datos con estilos
    const wsData: any[][] = []

    // Fila 1: Título de la empresa (con estilo)
    const companyRow = Array(colCount).fill({ v: '', s: excelStyles.companyTitle })
    companyRow[0] = { v: 'GRUPO EMPRESARIAL SANTACRUZ', s: excelStyles.companyTitle }
    wsData.push(companyRow)

    // Fila 2: Subtítulo
    const subtitleRow = Array(colCount).fill({ v: '', s: excelStyles.subtitle })
    subtitleRow[0] = { v: 'Sistema de Gestión de Canastillas', s: excelStyles.subtitle }
    wsData.push(subtitleRow)

    // Fila 3: Vacía
    wsData.push(Array(colCount).fill({ v: '' }))

    // Fila 4: Título del reporte
    const titleRow = Array(colCount).fill({ v: '', s: excelStyles.reportTitle })
    titleRow[0] = { v: title.toUpperCase(), s: excelStyles.reportTitle }
    wsData.push(titleRow)

    // Fila 5: Fecha de generación
    const fechaGen = `Generado: ${new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}${options?.dateRange ? `  |  Período: ${options.dateRange}` : ''}`
    const dateRow = Array(colCount).fill({ v: '', s: excelStyles.dateInfo })
    dateRow[0] = { v: fechaGen, s: excelStyles.dateInfo }
    wsData.push(dateRow)

    // Fila 6: Vacía
    wsData.push(Array(colCount).fill({ v: '' }))

    // Fila 7: Encabezados con estilo
    const headerRow = headers.map(h => ({ v: h, s: excelStyles.header }))
    wsData.push(headerRow)

    // Filas de datos con estilos alternados
    data.forEach((row, rowIndex) => {
      const style = rowIndex % 2 === 0 ? excelStyles.dataCell : excelStyles.dataCellAlt
      const styledRow = row.map((cell, colIndex) => {
        const cellStyle = { ...style }

        // Aplicar formato de moneda si es columna de moneda
        if (options?.currencyColumns?.includes(colIndex) && typeof cell === 'number') {
          return {
            v: cell,
            s: { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'right' } },
            z: '"$"#,##0'
          }
        }

        return { v: cell ?? '', s: cellStyle }
      })
      wsData.push(styledRow)
    })

    // Filas de resumen si existen
    if (options?.summaryData && options.summaryData.length > 0) {
      // Fila vacía antes del resumen
      wsData.push(Array(colCount).fill({ v: '' }))

      // Título del resumen
      const summaryTitleRow = Array(colCount).fill({ v: '', s: excelStyles.summaryTitle })
      summaryTitleRow[0] = { v: 'RESUMEN', s: excelStyles.summaryTitle }
      wsData.push(summaryTitleRow)

      // Filas de resumen
      options.summaryData.forEach(item => {
        const summaryRow = Array(colCount).fill({ v: '', s: excelStyles.summaryLabel })
        summaryRow[0] = { v: item.label, s: excelStyles.summaryLabel }
        summaryRow[1] = {
          v: item.value,
          s: excelStyles.summaryValue,
          z: typeof item.value === 'number' && item.label.toLowerCase().includes('ingreso') ? '"$"#,##0' : undefined
        }
        wsData.push(summaryRow)
      })
    }

    // Crear hoja
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Configurar anchos de columna
    ws['!cols'] = columnWidths.map(w => ({ wch: w }))

    // Configurar altura de filas
    ws['!rows'] = [
      { hpt: 30 }, // Título empresa
      { hpt: 20 }, // Subtítulo
      { hpt: 15 }, // Vacía
      { hpt: 25 }, // Título reporte
      { hpt: 18 }, // Fecha
      { hpt: 15 }, // Vacía
      { hpt: 25 }, // Headers
    ]

    // Configurar merges para el encabezado
    const lastCol = colCount - 1
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }, // Título empresa
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } }, // Subtítulo
      { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } }, // Título reporte
      { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } }, // Fecha generación
    ]

    // Agregar merge para título de resumen si existe
    if (options?.summaryData && options.summaryData.length > 0) {
      const summaryTitleRow = data.length + 8 // Posición del título de resumen
      ws['!merges'].push({ s: { r: summaryTitleRow, c: 0 }, e: { r: summaryTitleRow, c: lastCol } })
    }

    // Agregar hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')

    return wb
  }

  // Función para exportar
  const exportExcel = (wb: XLSX.WorkBook, fileName: string) => {
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const generateReport = async () => {
    if (!selectedReport) return

    const option = allReportOptions.find(r => r.id === selectedReport)

    // Verificar permiso antes de generar
    if (option && !hasPermission(option.permissionKey)) {
      setError('No tienes permiso para generar este reporte')
      return
    }

    if (option?.requiresDateRange && (!fechaInicio || !fechaFin)) {
      setError('Por favor selecciona el rango de fechas')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      switch (selectedReport) {
        case 'inventario':
          await generateInventarioReport()
          break
        case 'alquileres':
          await generateAlquileresReport()
          break
        case 'traspasos':
          await generateTraspasosReport()
          break
        case 'clientes':
          await generateClientesReport()
          break
        case 'usuarios':
          await generateUsuariosReport()
          break
        case 'ingresos':
          await generateIngresosReport()
          break
        case 'canastillas_alquiladas':
          await generateCanastillasAlquiladasReport()
          break
        case 'clientes_frecuentes':
          await generateClientesFrecuentesReport()
          break
      }
      setSuccess('Reporte generado exitosamente')
    } catch (err) {
      console.error('Error generating report:', err)
      setError('Error al generar el reporte. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ========== GENERADORES DE REPORTES PROFESIONALES ==========

  const generateInventarioReport = async () => {
    let allCanastillas: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('canastillas')
        .select(`
          *,
          current_owner:users!canastillas_current_owner_id_fkey(first_name, last_name)
        `)
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('codigo')

      if (error) throw error

      if (data && data.length > 0) {
        allCanastillas = [...allCanastillas, ...data]
        page++
      }

      hasMore = data?.length === pageSize
    }

    const headers = ['Código', 'Tamaño', 'Color', 'Estado', 'Condición', 'Tipo', 'Ubicación', 'Área', 'Propietario', 'Fecha Registro']

    const reportData = allCanastillas.map(c => [
      c.codigo,
      c.size,
      c.color,
      c.status,
      c.condition,
      c.tipo_propiedad,
      c.current_location || 'N/A',
      c.current_area || 'N/A',
      c.current_owner ? `${c.current_owner.first_name} ${c.current_owner.last_name}` : 'Sin asignar',
      formatDateDisplay(c.created_at)
    ])

    // Calcular resumen por estado
    const statusCount: Record<string, number> = {}
    allCanastillas.forEach(c => {
      statusCount[c.status] = (statusCount[c.status] || 0) + 1
    })

    const summaryData = [
      { label: 'Total Canastillas', value: allCanastillas.length },
      ...Object.entries(statusCount).map(([status, count]) => ({
        label: status,
        value: count
      }))
    ]

    const columnWidths = [12, 12, 12, 15, 12, 12, 15, 12, 25, 15]

    const wb = createStyledWorkbook(
      'Reporte de Inventario de Canastillas',
      headers,
      reportData,
      columnWidths,
      { summaryData }
    )

    exportExcel(wb, 'Inventario_Canastillas')
  }

  const generateAlquileresReport = async () => {
    const { data, error } = await supabase
      .from('rentals')
      .select(`
        *,
        sale_point:sale_points(name, code, city),
        rental_items(id)
      `)
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin + 'T23:59:59')
      .order('created_at', { ascending: false })

    if (error) throw error

    const headers = ['N° Remisión', 'Cliente', 'Ciudad', 'Tipo', 'Estado', 'Fecha Inicio', 'Fecha Dev.', 'Días', 'Tarifa', 'Total', 'Canastillas']

    const reportData = (data || []).map(r => [
      r.remision_number || 'N/A',
      r.sale_point?.name || 'N/A',
      r.sale_point?.city || 'N/A',
      r.rental_type,
      r.status,
      formatDateDisplay(r.start_date),
      formatDateDisplay(r.actual_return_date || r.estimated_return_date),
      r.actual_days || r.estimated_days || 0,
      r.daily_rate,
      r.total_amount || 0,
      r.rental_items?.length || 0
    ])

    const totalMonto = (data || []).reduce((sum, r) => sum + (r.total_amount || 0), 0)
    const totalCanastillas = (data || []).reduce((sum, r) => sum + (r.rental_items?.length || 0), 0)

    const summaryData = [
      { label: 'Total Alquileres', value: data?.length || 0 },
      { label: 'Total Canastillas', value: totalCanastillas },
      { label: 'Ingresos Totales', value: totalMonto },
      { label: 'Promedio por Alquiler', value: data?.length ? Math.round(totalMonto / data.length) : 0 },
    ]

    const columnWidths = [12, 25, 15, 10, 12, 12, 12, 8, 12, 14, 12]

    const wb = createStyledWorkbook(
      'Reporte de Alquileres',
      headers,
      reportData,
      columnWidths,
      {
        dateRange: `${formatDateDisplay(fechaInicio)} - ${formatDateDisplay(fechaFin)}`,
        summaryData,
        currencyColumns: [8, 9]
      }
    )

    exportExcel(wb, 'Reporte_Alquileres')
  }

  const generateTraspasosReport = async () => {
    const { data, error } = await supabase
      .from('transfers')
      .select(`
        *,
        from_user:users!transfers_from_user_id_fkey(first_name, last_name),
        to_user:users!transfers_to_user_id_fkey(first_name, last_name)
      `)
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin + 'T23:59:59')
      .order('created_at', { ascending: false })

    if (error) throw error

    const headers = ['N° Remisión', 'Origen', 'Destino', 'Estado', 'Fecha Solicitud', 'Fecha Respuesta', 'Canastillas', 'Notas']

    const reportData = (data || []).map(t => [
      t.remision_number || 'N/A',
      t.from_user ? `${t.from_user.first_name} ${t.from_user.last_name}` : 'N/A',
      t.to_user ? `${t.to_user.first_name} ${t.to_user.last_name}` : 'N/A',
      t.status,
      formatDateDisplay(t.requested_at),
      formatDateDisplay(t.responded_at),
      t.items_count || 0,
      t.notes || ''
    ])

    const statusCount: Record<string, number> = {}
    let totalCanastillas = 0
    ;(data || []).forEach(t => {
      statusCount[t.status] = (statusCount[t.status] || 0) + 1
      totalCanastillas += t.items_count || 0
    })

    const summaryData = [
      { label: 'Total Traspasos', value: data?.length || 0 },
      { label: 'Total Canastillas', value: totalCanastillas },
      ...Object.entries(statusCount).map(([status, count]) => ({
        label: status,
        value: count
      }))
    ]

    const columnWidths = [12, 25, 25, 12, 15, 15, 12, 30]

    const wb = createStyledWorkbook(
      'Reporte de Traspasos',
      headers,
      reportData,
      columnWidths,
      {
        dateRange: `${formatDateDisplay(fechaInicio)} - ${formatDateDisplay(fechaFin)}`,
        summaryData
      }
    )

    exportExcel(wb, 'Reporte_Traspasos')
  }

  const generateClientesReport = async () => {
    const { data, error } = await supabase
      .from('sale_points')
      .select('*')
      .order('name')

    if (error) throw error

    const headers = ['Nombre', 'Código', 'Tipo', 'NIT/Cédula', 'Contacto', 'Teléfono', 'Email', 'Ciudad', 'Estado']

    const reportData = (data || []).map(c => [
      c.name,
      c.code,
      c.client_type === 'PUNTO_VENTA' ? 'Punto de Venta' : 'Cliente Externo',
      c.identification || 'N/A',
      c.contact_name,
      c.contact_phone,
      c.contact_email || 'N/A',
      c.city,
      c.is_active ? 'Activo' : 'Inactivo'
    ])

    const activos = (data || []).filter(c => c.is_active).length
    const puntoVenta = (data || []).filter(c => c.client_type === 'PUNTO_VENTA').length

    const summaryData = [
      { label: 'Total Clientes', value: data?.length || 0 },
      { label: 'Activos', value: activos },
      { label: 'Inactivos', value: (data?.length || 0) - activos },
      { label: 'Puntos de Venta', value: puntoVenta },
      { label: 'Clientes Externos', value: (data?.length || 0) - puntoVenta },
    ]

    const columnWidths = [25, 12, 15, 15, 20, 15, 25, 15, 10]

    const wb = createStyledWorkbook(
      'Reporte de Clientes',
      headers,
      reportData,
      columnWidths,
      { summaryData }
    )

    exportExcel(wb, 'Reporte_Clientes')
  }

  const generateUsuariosReport = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('first_name')

    if (error) throw error

    const roleNames: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Administrador',
      supervisor: 'Supervisor',
      operator: 'Operador',
      washing_staff: 'Lavado',
      logistics: 'Logística',
      conductor: 'Conductor',
      client: 'Cliente',
    }

    const headers = ['Nombre', 'Email', 'Teléfono', 'Rol', 'Departamento', 'Estado', 'Registro']

    const reportData = (data || []).map(u => [
      `${u.first_name} ${u.last_name}`,
      u.email,
      u.phone || 'N/A',
      roleNames[u.role] || u.role,
      u.department || 'N/A',
      u.is_active ? 'Activo' : 'Inactivo',
      formatDateDisplay(u.created_at)
    ])

    const roleCount: Record<string, number> = {}
    const activos = (data || []).filter(u => u.is_active).length
    ;(data || []).forEach(u => {
      const roleName = roleNames[u.role] || u.role
      roleCount[roleName] = (roleCount[roleName] || 0) + 1
    })

    const summaryData = [
      { label: 'Total Usuarios', value: data?.length || 0 },
      { label: 'Activos', value: activos },
      { label: 'Inactivos', value: (data?.length || 0) - activos },
      ...Object.entries(roleCount).map(([role, count]) => ({
        label: role,
        value: count
      }))
    ]

    const columnWidths = [25, 30, 15, 15, 15, 10, 12]

    const wb = createStyledWorkbook(
      'Reporte de Usuarios',
      headers,
      reportData,
      columnWidths,
      { summaryData }
    )

    exportExcel(wb, 'Reporte_Usuarios')
  }

  const generateIngresosReport = async () => {
    const { data, error } = await supabase
      .from('rentals')
      .select('*, rental_items(id)')
      .eq('status', 'RETORNADO')
      .gte('actual_return_date', fechaInicio)
      .lte('actual_return_date', fechaFin + 'T23:59:59')

    if (error) throw error

    if (!data || data.length === 0) {
      setError('No hay datos de ingresos en el período seleccionado')
      return
    }

    const groupedByDate: Record<string, { ingresos: number; alquileres: number; canastillas: number }> = {}

    data.forEach((rental) => {
      const fecha = formatDateDisplay(rental.actual_return_date)
      if (!groupedByDate[fecha]) {
        groupedByDate[fecha] = { ingresos: 0, alquileres: 0, canastillas: 0 }
      }
      groupedByDate[fecha].ingresos += rental.total_amount || 0
      groupedByDate[fecha].alquileres += 1
      groupedByDate[fecha].canastillas += rental.rental_items?.length || 0
    })

    const headers = ['Fecha', 'Ingresos', 'Alquileres', 'Canastillas', 'Promedio']

    const reportData = Object.entries(groupedByDate)
      .sort((a, b) => {
        const dateA = a[0].split('/').reverse().join('-')
        const dateB = b[0].split('/').reverse().join('-')
        return dateA.localeCompare(dateB)
      })
      .map(([fecha, datos]) => [
        fecha,
        datos.ingresos,
        datos.alquileres,
        datos.canastillas,
        Math.round(datos.ingresos / datos.alquileres)
      ])

    const totalIngresos = data.reduce((sum, r) => sum + (r.total_amount || 0), 0)
    const totalCanastillas = data.reduce((sum, r) => sum + (r.rental_items?.length || 0), 0)

    const summaryData = [
      { label: 'Ingresos Totales', value: totalIngresos },
      { label: 'Total Alquileres', value: data.length },
      { label: 'Total Canastillas', value: totalCanastillas },
      { label: 'Promedio por Alquiler', value: Math.round(totalIngresos / data.length) },
      { label: 'Promedio Diario', value: Math.round(totalIngresos / Object.keys(groupedByDate).length) },
    ]

    const columnWidths = [15, 18, 15, 15, 18]

    const wb = createStyledWorkbook(
      'Reporte de Ingresos',
      headers,
      reportData,
      columnWidths,
      {
        dateRange: `${formatDateDisplay(fechaInicio)} - ${formatDateDisplay(fechaFin)}`,
        summaryData,
        currencyColumns: [1, 4]
      }
    )

    exportExcel(wb, 'Reporte_Ingresos')
  }

  const generateCanastillasAlquiladasReport = async () => {
    const { data, error } = await supabase
      .from('rental_items')
      .select(`
        canastilla_id,
        canastilla:canastillas(codigo, size, color),
        rental:rentals!inner(status, actual_return_date, actual_days, total_amount, rental_items(id))
      `)
      .eq('rental.status', 'RETORNADO')
      .gte('rental.actual_return_date', fechaInicio)
      .lte('rental.actual_return_date', fechaFin + 'T23:59:59')

    if (error) throw error

    if (!data || data.length === 0) {
      setError('No hay datos en el período seleccionado')
      return
    }

    const grouped: Record<string, any> = {}

    data.forEach((item: any) => {
      const id = item.canastilla_id
      if (!grouped[id]) {
        grouped[id] = {
          codigo: item.canastilla.codigo,
          size: item.canastilla.size,
          color: item.canastilla.color,
          alquileres: 0,
          dias: 0,
          ingresos: 0,
        }
      }
      grouped[id].alquileres += 1
      grouped[id].dias += item.rental.actual_days || 0
      grouped[id].ingresos += (item.rental.total_amount || 0) / (item.rental.rental_items?.length || 1)
    })

    const sorted = Object.values(grouped).sort((a: any, b: any) => b.alquileres - a.alquileres)

    const headers = ['#', 'Código', 'Tamaño', 'Color', 'Alquileres', 'Días', 'Ingresos']

    const reportData = sorted.map((c: any, i) => [
      i + 1,
      c.codigo,
      c.size,
      c.color,
      c.alquileres,
      c.dias,
      Math.round(c.ingresos)
    ])

    const totalIngresos = sorted.reduce((sum: number, c: any) => sum + c.ingresos, 0)
    const totalAlquileres = sorted.reduce((sum: number, c: any) => sum + c.alquileres, 0)

    const summaryData = [
      { label: 'Canastillas Únicas', value: sorted.length },
      { label: 'Total Alquileres', value: totalAlquileres },
      { label: 'Ingresos Totales', value: Math.round(totalIngresos) },
    ]

    const columnWidths = [8, 15, 12, 12, 12, 10, 15]

    const wb = createStyledWorkbook(
      'Ranking - Canastillas Más Alquiladas',
      headers,
      reportData,
      columnWidths,
      {
        dateRange: `${formatDateDisplay(fechaInicio)} - ${formatDateDisplay(fechaFin)}`,
        summaryData,
        currencyColumns: [6]
      }
    )

    exportExcel(wb, 'Top_Canastillas')
  }

  const generateClientesFrecuentesReport = async () => {
    const { data, error } = await supabase
      .from('rentals')
      .select(`
        sale_point_id,
        sale_point:sale_points(name, code, city, contact_phone),
        actual_return_date,
        actual_days,
        total_amount,
        rental_items(id)
      `)
      .eq('status', 'RETORNADO')
      .gte('actual_return_date', fechaInicio)
      .lte('actual_return_date', fechaFin + 'T23:59:59')

    if (error) throw error

    if (!data || data.length === 0) {
      setError('No hay datos en el período seleccionado')
      return
    }

    const grouped: Record<string, any> = {}

    data.forEach((rental: any) => {
      const id = rental.sale_point_id
      if (!grouped[id]) {
        grouped[id] = {
          nombre: rental.sale_point?.name || 'N/A',
          codigo: rental.sale_point?.code || 'N/A',
          ciudad: rental.sale_point?.city || 'N/A',
          telefono: rental.sale_point?.contact_phone || 'N/A',
          alquileres: 0,
          canastillas: 0,
          ingresos: 0,
        }
      }
      grouped[id].alquileres += 1
      grouped[id].canastillas += rental.rental_items?.length || 0
      grouped[id].ingresos += rental.total_amount || 0
    })

    const sorted = Object.values(grouped).sort((a: any, b: any) => b.ingresos - a.ingresos)

    const headers = ['#', 'Cliente', 'Ciudad', 'Teléfono', 'Alquileres', 'Canastillas', 'Ingresos']

    const reportData = sorted.map((c: any, i) => [
      i + 1,
      c.nombre,
      c.ciudad,
      c.telefono,
      c.alquileres,
      c.canastillas,
      c.ingresos
    ])

    const totalIngresos = sorted.reduce((sum: number, c: any) => sum + c.ingresos, 0)
    const totalAlquileres = sorted.reduce((sum: number, c: any) => sum + c.alquileres, 0)

    const summaryData = [
      { label: 'Clientes Activos', value: sorted.length },
      { label: 'Total Alquileres', value: totalAlquileres },
      { label: 'Ingresos Totales', value: totalIngresos },
      { label: 'Promedio por Cliente', value: Math.round(totalIngresos / sorted.length) },
    ]

    const columnWidths = [8, 25, 15, 15, 12, 12, 15]

    const wb = createStyledWorkbook(
      'Ranking - Clientes Frecuentes',
      headers,
      reportData,
      columnWidths,
      {
        dateRange: `${formatDateDisplay(fechaInicio)} - ${formatDateDisplay(fechaFin)}`,
        summaryData,
        currencyColumns: [6]
      }
    )

    exportExcel(wb, 'Top_Clientes')
  }

  const selectedOption = reportOptions.find(r => r.id === selectedReport)

  return (
    <DashboardLayout title="Reportes" subtitle="Genera y descarga reportes profesionales en Excel">
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-green-700 text-sm">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setSelectedReport(option.id)
                setError(null)
                setSuccess(null)
              }}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                selectedReport === option.id
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'
              }`}
            >
              <div className={`mb-3 ${selectedReport === option.id ? 'text-primary-600' : 'text-gray-400'}`}>
                {option.icon}
              </div>
              <h3 className={`font-semibold text-sm mb-1 ${
                selectedReport === option.id ? 'text-primary-700' : 'text-gray-900'
              }`}>
                {option.name}
              </h3>
              <p className="text-xs text-gray-500 line-clamp-2">{option.description}</p>
              {option.requiresDateRange && (
                <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Requiere fechas
                </span>
              )}
            </button>
          ))}
        </div>

        {selectedReport && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedOption?.name}</h2>
                <p className="text-sm text-gray-500">{selectedOption?.description}</p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-green-600 font-medium">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Excel con Estilos</span>
              </div>
            </div>

            {selectedOption?.requiresDateRange && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 mb-6 border border-green-200">
              <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Características del Reporte
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Encabezado corporativo</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Colores institucionales</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Bordes y formatos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Sección de resumen</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Formato de moneda COP</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Filas alternadas</span>
                </div>
              </div>
            </div>

            <button
              onClick={generateReport}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium transition-all shadow-lg shadow-green-200"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Descargar Reporte Excel</span>
                </>
              )}
            </button>
          </div>
        )}

        {!selectedReport && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-blue-900 mb-2">Selecciona un Reporte</h3>
            <p className="text-sm text-blue-700 max-w-md mx-auto">
              Elige uno de los reportes disponibles arriba para configurarlo y descargarlo en formato Excel profesional con diseño corporativo.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
