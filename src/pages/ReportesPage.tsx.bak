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
  | 'ingresos'
  | 'trazabilidad'

interface ReportOption {
  id: ReportType
  name: string
  description: string
  icon: React.ReactNode
  requiresDateRange: boolean
  permissionKey: PermissionKey
}

interface ReportCategory {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  color: string
  reports: ReportOption[]
}

// Paleta de colores para estilos Excel
const COLORS = {
  brand: '166534',
  brandLight: '16A34A',
  brandBg: 'DCFCE7',
  brandBgLight: 'F0FDF4',
  dark: '111827',
  medium: '374151',
  muted: '6B7280',
  light: 'F3F4F6',
  lightest: 'F9FAFB',
  white: 'FFFFFF',
  border: 'E5E7EB',
  borderDark: 'D1D5DB',
  accentBlue: '1E40AF',
  accentBlueBg: 'DBEAFE',
  accentAmber: '92400E',
  accentAmberBg: 'FEF3C7',
}

// Estilos profesionales para Excel
const excelStyles = {
  companyTitle: {
    font: { bold: true, sz: 20, color: { rgb: COLORS.brand } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    fill: { fgColor: { rgb: COLORS.white } },
  },
  subtitle: {
    font: { sz: 11, color: { rgb: COLORS.muted } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
  },
  reportTitle: {
    font: { bold: true, sz: 14, color: { rgb: COLORS.white } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    fill: { fgColor: { rgb: COLORS.brand } },
  },
  dateInfo: {
    font: { sz: 10, italic: true, color: { rgb: COLORS.muted } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    fill: { fgColor: { rgb: COLORS.lightest } },
  },
  header: {
    font: { bold: true, sz: 11, color: { rgb: COLORS.white } },
    fill: { fgColor: { rgb: COLORS.brandLight } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    border: {
      top: { style: 'thin' as const, color: { rgb: COLORS.brand } },
      bottom: { style: 'thin' as const, color: { rgb: COLORS.brand } },
      left: { style: 'thin' as const, color: { rgb: COLORS.brand } },
      right: { style: 'thin' as const, color: { rgb: COLORS.brand } },
    },
  },
  dataCell: {
    font: { sz: 10, color: { rgb: COLORS.dark } },
    alignment: { vertical: 'center' as const },
    border: {
      top: { style: 'thin' as const, color: { rgb: COLORS.border } },
      bottom: { style: 'thin' as const, color: { rgb: COLORS.border } },
      left: { style: 'thin' as const, color: { rgb: COLORS.border } },
      right: { style: 'thin' as const, color: { rgb: COLORS.border } },
    },
  },
  dataCellAlt: {
    font: { sz: 10, color: { rgb: COLORS.dark } },
    alignment: { vertical: 'center' as const },
    fill: { fgColor: { rgb: COLORS.lightest } },
    border: {
      top: { style: 'thin' as const, color: { rgb: COLORS.border } },
      bottom: { style: 'thin' as const, color: { rgb: COLORS.border } },
      left: { style: 'thin' as const, color: { rgb: COLORS.border } },
      right: { style: 'thin' as const, color: { rgb: COLORS.border } },
    },
  },
  summaryTitle: {
    font: { bold: true, sz: 12, color: { rgb: COLORS.brand } },
    fill: { fgColor: { rgb: COLORS.brandBg } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    border: {
      top: { style: 'medium' as const, color: { rgb: COLORS.brandLight } },
      bottom: { style: 'thin' as const, color: { rgb: COLORS.brandLight } },
      left: { style: 'thin' as const, color: { rgb: COLORS.brandLight } },
      right: { style: 'thin' as const, color: { rgb: COLORS.brandLight } },
    },
  },
  summaryLabel: {
    font: { bold: true, sz: 10, color: { rgb: COLORS.medium } },
    fill: { fgColor: { rgb: COLORS.brandBgLight } },
    border: {
      top: { style: 'thin' as const, color: { rgb: COLORS.borderDark } },
      bottom: { style: 'thin' as const, color: { rgb: COLORS.borderDark } },
      left: { style: 'thin' as const, color: { rgb: COLORS.borderDark } },
      right: { style: 'thin' as const, color: { rgb: COLORS.borderDark } },
    },
  },
  summaryValue: {
    font: { bold: true, sz: 11, color: { rgb: COLORS.brand } },
    fill: { fgColor: { rgb: COLORS.brandBgLight } },
    alignment: { horizontal: 'right' as const },
    border: {
      top: { style: 'thin' as const, color: { rgb: COLORS.borderDark } },
      bottom: { style: 'thin' as const, color: { rgb: COLORS.borderDark } },
      left: { style: 'thin' as const, color: { rgb: COLORS.borderDark } },
      right: { style: 'thin' as const, color: { rgb: COLORS.borderDark } },
    },
  },
  sectionHeader: {
    font: { bold: true, sz: 11, color: { rgb: COLORS.accentBlue } },
    fill: { fgColor: { rgb: COLORS.accentBlueBg } },
    alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    border: {
      top: { style: 'thin' as const, color: { rgb: COLORS.accentBlue } },
      bottom: { style: 'thin' as const, color: { rgb: COLORS.accentBlue } },
      left: { style: 'thin' as const, color: { rgb: COLORS.accentBlue } },
      right: { style: 'thin' as const, color: { rgb: COLORS.accentBlue } },
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

  // ========== DEFINICIÓN DE REPORTES POR CATEGORÍA ==========

  const categories: ReportCategory[] = [
    {
      id: 'inventario-ops',
      name: 'Inventario & Operaciones',
      description: 'Control de activos, movimientos y trazabilidad completa',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'emerald',
      reports: [
        {
          id: 'inventario',
          name: 'Inventario General',
          description: 'Estado actual de todas las canastillas: ubicación, propietario, condición y estado',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
          requiresDateRange: false,
          permissionKey: 'reportes.inventario',
        },
        {
          id: 'traspasos',
          name: 'Traspasos',
          description: 'Historial de movimientos entre sedes, usuarios y terceros con estados y remisiones',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          ),
          requiresDateRange: true,
          permissionKey: 'reportes.traspasos',
        },
        {
          id: 'trazabilidad',
          name: 'Trazabilidad',
          description: 'Historial completo de movimientos por lote: creación, traspasos, alquileres y lavados',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          ),
          requiresDateRange: false,
          permissionKey: 'reportes.inventario',
        },
      ],
    },
    {
      id: 'financiero',
      name: 'Financiero & Alquileres',
      description: 'Facturación, ingresos y análisis de alquileres por período',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'blue',
      reports: [
        {
          id: 'alquileres',
          name: 'Alquileres',
          description: 'Detalle de todos los alquileres: clientes, montos, fechas, días y estados',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          requiresDateRange: true,
          permissionKey: 'reportes.alquileres',
        },
        {
          id: 'ingresos',
          name: 'Análisis de Ingresos',
          description: 'Desglose diario de ingresos con totales, promedios y tendencias',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          ),
          requiresDateRange: true,
          permissionKey: 'reportes.ingresos',
        },
      ],
    },
  ]

  // Filtrar categorías y reportes según permisos
  const filteredCategories = categories
    .map(cat => ({
      ...cat,
      reports: cat.reports.filter(r => hasPermission(r.permissionKey)),
    }))
    .filter(cat => cat.reports.length > 0)

  const allReports = filteredCategories.flatMap(c => c.reports)

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
      sheetName?: string
    }
  ) => {
    const wb = XLSX.utils.book_new()
    const colCount = headers.length
    const wsData: any[][] = []

    // Fila 1: Título empresa
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
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })}${options?.dateRange ? `  |  Período: ${options.dateRange}` : ''}`
    const dateRow = Array(colCount).fill({ v: '', s: excelStyles.dateInfo })
    dateRow[0] = { v: fechaGen, s: excelStyles.dateInfo }
    wsData.push(dateRow)

    // Fila 6: Vacía
    wsData.push(Array(colCount).fill({ v: '' }))

    // Fila 7: Encabezados
    wsData.push(headers.map(h => ({ v: h, s: excelStyles.header })))

    // Filas de datos
    data.forEach((row, rowIndex) => {
      const style = rowIndex % 2 === 0 ? excelStyles.dataCell : excelStyles.dataCellAlt
      const styledRow = row.map((cell, colIndex) => {
        if (options?.currencyColumns?.includes(colIndex) && typeof cell === 'number') {
          return {
            v: cell,
            s: { ...style, alignment: { ...style.alignment, horizontal: 'right' as const } },
            z: '"$"#,##0'
          }
        }
        return { v: cell ?? '', s: style }
      })
      wsData.push(styledRow)
    })

    // Resumen
    if (options?.summaryData && options.summaryData.length > 0) {
      wsData.push(Array(colCount).fill({ v: '' }))

      const summaryTitleRow = Array(colCount).fill({ v: '', s: excelStyles.summaryTitle })
      summaryTitleRow[0] = { v: 'RESUMEN', s: excelStyles.summaryTitle }
      wsData.push(summaryTitleRow)

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

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = columnWidths.map(w => ({ wch: w }))
    ws['!rows'] = [
      { hpt: 35 }, { hpt: 20 }, { hpt: 10 }, { hpt: 28 }, { hpt: 18 }, { hpt: 10 }, { hpt: 28 },
    ]

    const lastCol = colCount - 1
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } },
    ]

    if (options?.summaryData && options.summaryData.length > 0) {
      const summaryTitleIdx = data.length + 8
      ws['!merges'].push({ s: { r: summaryTitleIdx, c: 0 }, e: { r: summaryTitleIdx, c: lastCol } })
    }

    XLSX.utils.book_append_sheet(wb, ws, options?.sheetName || 'Reporte')
    return wb
  }

  const exportExcel = (wb: XLSX.WorkBook, fileName: string) => {
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ========== GENERADOR PRINCIPAL ==========

  const generateReport = async () => {
    if (!selectedReport) return

    const option = allReports.find(r => r.id === selectedReport)
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
        case 'inventario': await generateInventarioReport(); break
        case 'alquileres': await generateAlquileresReport(); break
        case 'traspasos': await generateTraspasosReport(); break
        case 'ingresos': await generateIngresosReport(); break
        case 'trazabilidad': await generateTrazabilidadReport(); break
      }
      setSuccess('Reporte generado y descargado exitosamente')
    } catch (err) {
      console.error('Error generating report:', err)
      setError('Error al generar el reporte. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ========== GENERADORES INDIVIDUALES ==========

  const generateInventarioReport = async () => {
    let allCanastillas: any[] = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from('canastillas')
        .select(`*, current_owner:users!canastillas_current_owner_id_fkey(first_name, last_name)`)
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('codigo')
      if (error) throw error
      if (!data || data.length === 0) break
      allCanastillas = [...allCanastillas, ...data]
      if (data.length < pageSize) break
      page++
    }

    const statusLabels: Record<string, string> = {
      DISPONIBLE: 'Disponible',
      EN_ALQUILER: 'En Alquiler',
      EN_LAVADO: 'En Lavado',
      EN_TRANSITO: 'En Tránsito',
      DANADA: 'Dañada',
      PERDIDA: 'Perdida',
      EN_MANTENIMIENTO: 'En Mantenimiento',
    }

    const headers = ['#', 'Código', 'Tamaño', 'Color', 'Estado', 'Condición', 'Tipo Propiedad', 'Ubicación', 'Área', 'Propietario', 'Fecha Registro']

    const reportData = allCanastillas.map((c, i) => [
      i + 1,
      c.codigo,
      c.size,
      c.color,
      statusLabels[c.status] || c.status,
      c.condition === 'BUENA' ? 'Buena' : c.condition === 'REGULAR' ? 'Regular' : c.condition === 'MALA' ? 'Mala' : c.condition,
      c.tipo_propiedad === 'PROPIA' ? 'Propia' : 'Alquilada',
      c.current_location || '-',
      c.current_area || '-',
      c.current_owner ? `${c.current_owner.first_name} ${c.current_owner.last_name}` : 'Sin asignar',
      formatDateDisplay(c.created_at)
    ])

    const statusCount: Record<string, number> = {}
    allCanastillas.forEach(c => {
      const label = statusLabels[c.status] || c.status
      statusCount[label] = (statusCount[label] || 0) + 1
    })

    const summaryData = [
      { label: 'Total Canastillas', value: allCanastillas.length },
      ...Object.entries(statusCount).map(([status, count]) => ({ label: status, value: count })),
    ]

    const wb = createStyledWorkbook('Reporte de Inventario General', headers, reportData,
      [6, 14, 10, 10, 14, 12, 14, 16, 12, 25, 14],
      { summaryData, sheetName: 'Inventario' })
    exportExcel(wb, 'Inventario_Canastillas')
  }

  const generateAlquileresReport = async () => {
    const { data, error } = await supabase
      .from('rentals')
      .select(`*, sale_point:sale_points(name, code, city), rental_items(id)`)
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin + 'T23:59:59')
      .order('created_at', { ascending: false })
    if (error) throw error

    const statusLabels: Record<string, string> = {
      ACTIVO: 'Activo',
      RETORNADO: 'Retornado',
      CANCELADO: 'Cancelado',
      VENCIDO: 'Vencido',
    }

    const headers = ['#', 'N° Remisión', 'Cliente', 'Ciudad', 'Tipo', 'Estado', 'Fecha Inicio', 'Fecha Devolución', 'Días', 'Tarifa Diaria', 'Total', 'Canastillas']

    const reportData = (data || []).map((r, i) => [
      i + 1,
      r.remision_number || 'N/A',
      r.sale_point?.name || 'N/A',
      r.sale_point?.city || 'N/A',
      r.rental_type === 'INTERNO' ? 'Interno' : 'Externo',
      statusLabels[r.status] || r.status,
      formatDateDisplay(r.start_date),
      formatDateDisplay(r.actual_return_date || r.estimated_return_date),
      r.actual_days || r.estimated_days || 0,
      r.daily_rate || 0,
      r.total_amount || 0,
      r.rental_items?.length || 0
    ])

    const totalMonto = (data || []).reduce((sum, r) => sum + (r.total_amount || 0), 0)
    const totalCanastillas = (data || []).reduce((sum, r) => sum + (r.rental_items?.length || 0), 0)
    const activos = (data || []).filter(r => r.status === 'ACTIVO').length
    const retornados = (data || []).filter(r => r.status === 'RETORNADO').length

    const summaryData = [
      { label: 'Total Alquileres', value: data?.length || 0 },
      { label: 'Activos', value: activos },
      { label: 'Retornados', value: retornados },
      { label: 'Total Canastillas Alquiladas', value: totalCanastillas },
      { label: 'Ingresos Totales', value: totalMonto },
      { label: 'Promedio por Alquiler', value: data?.length ? Math.round(totalMonto / data.length) : 0 },
    ]

    const wb = createStyledWorkbook('Reporte de Alquileres', headers, reportData,
      [6, 14, 25, 14, 10, 12, 14, 14, 8, 14, 14, 12],
      {
        dateRange: `${formatDateDisplay(fechaInicio)} - ${formatDateDisplay(fechaFin)}`,
        summaryData, currencyColumns: [9, 10], sheetName: 'Alquileres'
      })
    exportExcel(wb, 'Reporte_Alquileres')
  }

  const generateTraspasosReport = async () => {
    const { data, error } = await supabase
      .from('transfers')
      .select(`
        *,
        from_user:users!transfers_from_user_id_fkey(first_name, last_name),
        to_user:users!transfers_to_user_id_fkey(first_name, last_name),
        transfer_items(id)
      `)
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin + 'T23:59:59')
      .order('created_at', { ascending: false })
    if (error) throw error

    const statusLabels: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      ACEPTADO: 'Aceptado',
      RECHAZADO: 'Rechazado',
      DEVUELTO: 'Devuelto',
      DEVUELTO_PARCIAL: 'Dev. Parcial',
    }

    const headers = ['#', 'N° Remisión', 'Tipo', 'Origen', 'Destino', 'Estado', 'Fecha Solicitud', 'Fecha Respuesta', 'Canastillas', 'Notas']

    const reportData = (data || []).map((t, i) => [
      i + 1,
      t.remision_number || 'N/A',
      t.is_external_transfer ? 'Externo' : t.is_washing_transfer ? 'Lavado' : 'Interno',
      t.from_user ? `${t.from_user.first_name} ${t.from_user.last_name}` : 'N/A',
      t.is_external_transfer
        ? (t.external_recipient_name || 'Externo')
        : t.to_user ? `${t.to_user.first_name} ${t.to_user.last_name}` : 'N/A',
      statusLabels[t.status] || t.status,
      formatDateDisplay(t.requested_at || t.created_at),
      formatDateDisplay(t.responded_at),
      t.transfer_items?.length || t.items_count || 0,
      t.notes || ''
    ])

    const statusCount: Record<string, number> = {}
    let totalCanastillas = 0
    ;(data || []).forEach(t => {
      const label = statusLabels[t.status] || t.status
      statusCount[label] = (statusCount[label] || 0) + 1
      totalCanastillas += t.transfer_items?.length || t.items_count || 0
    })

    const summaryData = [
      { label: 'Total Traspasos', value: data?.length || 0 },
      { label: 'Total Canastillas Movidas', value: totalCanastillas },
      ...Object.entries(statusCount).map(([status, count]) => ({ label: status, value: count })),
    ]

    const wb = createStyledWorkbook('Reporte de Traspasos', headers, reportData,
      [6, 14, 10, 25, 25, 14, 14, 14, 12, 30],
      {
        dateRange: `${formatDateDisplay(fechaInicio)} - ${formatDateDisplay(fechaFin)}`,
        summaryData, sheetName: 'Traspasos'
      })
    exportExcel(wb, 'Reporte_Traspasos')
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
    data.forEach(rental => {
      const fecha = formatDateDisplay(rental.actual_return_date)
      if (!groupedByDate[fecha]) groupedByDate[fecha] = { ingresos: 0, alquileres: 0, canastillas: 0 }
      groupedByDate[fecha].ingresos += rental.total_amount || 0
      groupedByDate[fecha].alquileres += 1
      groupedByDate[fecha].canastillas += rental.rental_items?.length || 0
    })

    const headers = ['#', 'Fecha', 'Ingresos del Día', 'Alquileres', 'Canastillas', 'Promedio por Alquiler']

    const sorted = Object.entries(groupedByDate).sort((a, b) => {
      const dA = a[0].split('/').reverse().join('-')
      const dB = b[0].split('/').reverse().join('-')
      return dA.localeCompare(dB)
    })

    const reportData = sorted.map(([fecha, datos], i) => [
      i + 1,
      fecha,
      datos.ingresos,
      datos.alquileres,
      datos.canastillas,
      datos.alquileres > 0 ? Math.round(datos.ingresos / datos.alquileres) : 0
    ])

    const totalIngresos = data.reduce((sum, r) => sum + (r.total_amount || 0), 0)
    const totalCanastillas = data.reduce((sum, r) => sum + (r.rental_items?.length || 0), 0)
    const diasConDatos = Object.keys(groupedByDate).length

    const summaryData = [
      { label: 'Ingresos Totales', value: totalIngresos },
      { label: 'Total Alquileres Retornados', value: data.length },
      { label: 'Total Canastillas', value: totalCanastillas },
      { label: 'Promedio por Alquiler', value: Math.round(totalIngresos / data.length) },
      { label: 'Promedio Diario', value: Math.round(totalIngresos / diasConDatos) },
      { label: 'Días con Actividad', value: diasConDatos },
    ]

    const wb = createStyledWorkbook('Análisis de Ingresos', headers, reportData,
      [6, 14, 18, 12, 14, 18],
      {
        dateRange: `${formatDateDisplay(fechaInicio)} - ${formatDateDisplay(fechaFin)}`,
        summaryData, currencyColumns: [2, 5], sheetName: 'Ingresos'
      })
    exportExcel(wb, 'Analisis_Ingresos')
  }

  const generateTrazabilidadReport = async () => {
    // 1. Cargar todas las canastillas
    let allCanastillas: any[] = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from('canastillas')
        .select('id, codigo, size, color, shape, status, tipo_propiedad, created_at, current_location, current_area, current_owner_id')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      allCanastillas = [...allCanastillas, ...data]
      if (data.length < pageSize) break
      page++
    }

    if (allCanastillas.length === 0) {
      setError('No hay canastillas registradas')
      return
    }

    // 2. Agrupar en lotes
    const groups: Record<string, { size: string; color: string; tipo: string; createdAt: string; ids: string[]; codigos: string[]; statuses: Record<string, number> }> = {}
    for (const c of allCanastillas) {
      const dateKey = c.created_at.substring(0, 16)
      const key = `${dateKey}|${c.size}|${c.color}|${c.tipo_propiedad}`
      if (!groups[key]) {
        groups[key] = { size: c.size, color: c.color, tipo: c.tipo_propiedad, createdAt: c.created_at, ids: [], codigos: [], statuses: {} }
      }
      groups[key].ids.push(c.id)
      if (groups[key].codigos.length < 5) groups[key].codigos.push(c.codigo)
      groups[key].statuses[c.status] = (groups[key].statuses[c.status] || 0) + 1
    }

    const lotes = Object.entries(groups)
      .map(([key, g]) => ({ key, ...g, total: g.ids.length }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const allIds = allCanastillas.map(c => c.id)

    // 3. Cargar traspasos
    const BATCH_SIZE = 200
    let allTransferItems: any[] = []
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE)
      const { data: tiData } = await supabase
        .from('transfer_items')
        .select('transfer_id, canastilla_id')
        .in('canastilla_id', batch)
      if (tiData) allTransferItems = [...allTransferItems, ...tiData]
    }

    const transferIds = [...new Set(allTransferItems.map(ti => ti.transfer_id))]
    let allTransfers: any[] = []
    for (let i = 0; i < transferIds.length; i += BATCH_SIZE) {
      const batch = transferIds.slice(i, i + BATCH_SIZE)
      const { data: tData } = await supabase
        .from('transfers')
        .select('id, status, requested_at, remision_number, is_external_transfer, is_washing_transfer, from_user:users!transfers_from_user_id_fkey(first_name, last_name), to_user:users!transfers_to_user_id_fkey(first_name, last_name)')
        .in('id', batch)
      if (tData) allTransfers = [...allTransfers, ...tData]
    }
    const transferMap = new Map(allTransfers.map(t => [t.id, t]))

    // 4. Cargar alquileres
    let allRentalItems: any[] = []
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE)
      const { data: riData } = await supabase
        .from('rental_items')
        .select('rental_id, canastilla_id')
        .in('canastilla_id', batch)
      if (riData) allRentalItems = [...allRentalItems, ...riData]
    }

    const rentalIds = [...new Set(allRentalItems.map(ri => ri.rental_id))]
    let allRentals: any[] = []
    for (let i = 0; i < rentalIds.length; i += BATCH_SIZE) {
      const batch = rentalIds.slice(i, i + BATCH_SIZE)
      const { data: rData } = await supabase
        .from('rentals')
        .select('id, status, start_date, remision_number, total_amount, sale_point:sale_points(name)')
        .in('id', batch)
      if (rData) allRentals = [...allRentals, ...rData]
    }
    const rentalMap = new Map(allRentals.map(r => [r.id, r]))

    // 5. Construir el workbook con múltiples hojas
    const wb = XLSX.utils.book_new()
    const colCount = 8

    // === HOJA 1: Resumen de Lotes ===
    const lotesHeaders = ['#', 'Fecha Creación', 'Tamaño', 'Color', 'Tipo', 'Cantidad', 'Códigos (muestra)', 'Estado Actual']
    const lotesData = lotes.map((l, i) => [
      i + 1,
      formatDateDisplay(l.createdAt),
      l.size, l.color,
      l.tipo === 'PROPIA' ? 'Propia' : 'Alquilada',
      l.total,
      l.codigos.join(', ') + (l.total > 5 ? ` (+${l.total - 5})` : ''),
      Object.entries(l.statuses).map(([s, c]) => `${s}: ${c}`).join(' | ')
    ])

    const lotesSummary = [
      { label: 'Total de Lotes', value: lotes.length },
      { label: 'Total de Canastillas', value: allCanastillas.length },
      { label: 'Lotes con Propias', value: lotes.filter(l => l.tipo === 'PROPIA').length },
      { label: 'Lotes con Alquiladas', value: lotes.filter(l => l.tipo !== 'PROPIA').length },
    ]

    const ws1Data = buildSheetData('Resumen de Lotes por Trazabilidad', lotesHeaders, lotesData, lotesSummary)
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)
    ws1['!cols'] = [6, 14, 10, 10, 12, 10, 30, 35].map(w => ({ wch: w }))
    ws1['!rows'] = [{ hpt: 35 }, { hpt: 20 }, { hpt: 10 }, { hpt: 28 }, { hpt: 18 }, { hpt: 10 }, { hpt: 28 }]
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } },
    ]
    const smTitleIdx1 = lotesData.length + 8
    ws1['!merges'].push({ s: { r: smTitleIdx1, c: 0 }, e: { r: smTitleIdx1, c: colCount - 1 } })
    XLSX.utils.book_append_sheet(wb, ws1, 'Lotes')

    // === HOJA 2: Movimientos (Traspasos) ===
    const movHeaders = ['#', 'N° Remisión', 'Tipo', 'Fecha', 'Estado', 'Origen', 'Destino', 'Canastillas Involucradas']

    // Agrupar transfer_items por transfer_id con conteo
    const transferItemCount: Record<string, number> = {}
    allTransferItems.forEach(ti => {
      transferItemCount[ti.transfer_id] = (transferItemCount[ti.transfer_id] || 0) + 1
    })

    const movData = allTransfers
      .sort((a, b) => new Date(b.requested_at || 0).getTime() - new Date(a.requested_at || 0).getTime())
      .map((t, i) => [
        i + 1,
        t.remision_number || 'N/A',
        t.is_external_transfer ? 'Externo' : t.is_washing_transfer ? 'Lavado' : 'Interno',
        formatDateDisplay(t.requested_at),
        t.status,
        t.from_user ? `${t.from_user.first_name} ${t.from_user.last_name}` : 'N/A',
        t.to_user ? `${t.to_user.first_name} ${t.to_user.last_name}` : 'N/A',
        transferItemCount[t.id] || 0,
      ])

    const traspasosResumen = [
      { label: 'Total Traspasos', value: allTransfers.length },
      { label: 'Canastillas en Traspasos', value: allTransferItems.length },
    ]

    const ws2Data = buildSheetData('Historial de Traspasos (Trazabilidad)', movHeaders, movData, traspasosResumen)
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)
    ws2['!cols'] = [6, 14, 10, 14, 12, 25, 25, 16].map(w => ({ wch: w }))
    ws2['!rows'] = [{ hpt: 35 }, { hpt: 20 }, { hpt: 10 }, { hpt: 28 }, { hpt: 18 }, { hpt: 10 }, { hpt: 28 }]
    ws2['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } },
    ]
    const smTitleIdx2 = movData.length + 8
    ws2['!merges'].push({ s: { r: smTitleIdx2, c: 0 }, e: { r: smTitleIdx2, c: colCount - 1 } })
    XLSX.utils.book_append_sheet(wb, ws2, 'Traspasos')

    // === HOJA 3: Alquileres (Trazabilidad) ===
    const alqHeaders = ['#', 'N° Remisión', 'Cliente', 'Fecha', 'Estado', 'Monto', 'Canastillas Involucradas']

    const rentalItemCount: Record<string, number> = {}
    allRentalItems.forEach(ri => {
      rentalItemCount[ri.rental_id] = (rentalItemCount[ri.rental_id] || 0) + 1
    })

    const alqData = allRentals
      .sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime())
      .map((r, i) => [
        i + 1,
        r.remision_number || 'N/A',
        r.sale_point?.name || 'N/A',
        formatDateDisplay(r.start_date),
        r.status,
        r.total_amount || 0,
        rentalItemCount[r.id] || 0,
      ])

    const totalAlqIngresos = allRentals.reduce((sum, r) => sum + (r.total_amount || 0), 0)
    const alqResumen = [
      { label: 'Total Alquileres', value: allRentals.length },
      { label: 'Canastillas en Alquileres', value: allRentalItems.length },
      { label: 'Ingresos Totales', value: totalAlqIngresos },
    ]

    const alqColCount = 7
    const ws3Data = buildSheetData('Historial de Alquileres (Trazabilidad)', alqHeaders, alqData, alqResumen)
    const ws3 = XLSX.utils.aoa_to_sheet(ws3Data)
    ws3['!cols'] = [6, 14, 25, 14, 12, 16, 16].map(w => ({ wch: w }))
    ws3['!rows'] = [{ hpt: 35 }, { hpt: 20 }, { hpt: 10 }, { hpt: 28 }, { hpt: 18 }, { hpt: 10 }, { hpt: 28 }]
    ws3['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: alqColCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: alqColCount - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: alqColCount - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: alqColCount - 1 } },
    ]
    const smTitleIdx3 = alqData.length + 8
    ws3['!merges'].push({ s: { r: smTitleIdx3, c: 0 }, e: { r: smTitleIdx3, c: alqColCount - 1 } })
    XLSX.utils.book_append_sheet(wb, ws3, 'Alquileres')

    exportExcel(wb, 'Trazabilidad_Completa')
  }

  // Helper para construir los datos de una hoja con encabezado corporativo
  function buildSheetData(title: string, headers: string[], data: any[][], summaryData?: { label: string; value: string | number }[]) {
    const colCount = headers.length
    const wsData: any[][] = []

    const companyRow = Array(colCount).fill({ v: '', s: excelStyles.companyTitle })
    companyRow[0] = { v: 'GRUPO EMPRESARIAL SANTACRUZ', s: excelStyles.companyTitle }
    wsData.push(companyRow)

    const subtitleRow = Array(colCount).fill({ v: '', s: excelStyles.subtitle })
    subtitleRow[0] = { v: 'Sistema de Gestión de Canastillas', s: excelStyles.subtitle }
    wsData.push(subtitleRow)

    wsData.push(Array(colCount).fill({ v: '' }))

    const titleRow = Array(colCount).fill({ v: '', s: excelStyles.reportTitle })
    titleRow[0] = { v: title.toUpperCase(), s: excelStyles.reportTitle }
    wsData.push(titleRow)

    const fechaGen = `Generado: ${new Date().toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })}`
    const dateRow = Array(colCount).fill({ v: '', s: excelStyles.dateInfo })
    dateRow[0] = { v: fechaGen, s: excelStyles.dateInfo }
    wsData.push(dateRow)

    wsData.push(Array(colCount).fill({ v: '' }))
    wsData.push(headers.map(h => ({ v: h, s: excelStyles.header })))

    data.forEach((row, rowIndex) => {
      const style = rowIndex % 2 === 0 ? excelStyles.dataCell : excelStyles.dataCellAlt
      wsData.push(row.map((cell, colIndex) => {
        if (typeof cell === 'number' && headers[colIndex]?.toLowerCase().includes('monto')) {
          return { v: cell, s: { ...style, alignment: { ...style.alignment, horizontal: 'right' as const } }, z: '"$"#,##0' }
        }
        return { v: cell ?? '', s: style }
      }))
    })

    if (summaryData && summaryData.length > 0) {
      wsData.push(Array(colCount).fill({ v: '' }))
      const summaryTitleRow = Array(colCount).fill({ v: '', s: excelStyles.summaryTitle })
      summaryTitleRow[0] = { v: 'RESUMEN', s: excelStyles.summaryTitle }
      wsData.push(summaryTitleRow)
      summaryData.forEach(item => {
        const summaryRow = Array(colCount).fill({ v: '', s: excelStyles.summaryLabel })
        summaryRow[0] = { v: item.label, s: excelStyles.summaryLabel }
        summaryRow[1] = {
          v: item.value, s: excelStyles.summaryValue,
          z: typeof item.value === 'number' && item.label.toLowerCase().includes('ingreso') ? '"$"#,##0' : undefined
        }
        wsData.push(summaryRow)
      })
    }

    return wsData
  }

  const selectedOption = allReports.find(r => r.id === selectedReport)
  const selectedCategory = filteredCategories.find(c => c.reports.some(r => r.id === selectedReport))

  return (
    <DashboardLayout title="Reportes" subtitle="Genera reportes profesionales organizados por categoría">
      <div className="space-y-6">
        {/* Mensajes de error y éxito */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center space-x-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center space-x-3">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-green-700 dark:text-green-300 text-sm">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Categorías de reportes */}
        <div className="space-y-6">
          {filteredCategories.map(category => (
            <div key={category.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header de categoría */}
              <div className={`px-5 py-4 border-b border-gray-200 dark:border-gray-700 ${
                category.color === 'emerald'
                  ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20'
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    category.color === 'emerald'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-300'
                  }`}>
                    {category.icon}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">{category.name}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{category.description}</p>
                  </div>
                </div>
              </div>

              {/* Reportes de la categoría */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.reports.map(report => {
                  const isSelected = selectedReport === report.id
                  return (
                    <button
                      key={report.id}
                      onClick={() => {
                        setSelectedReport(report.id)
                        setError(null)
                        setSuccess(null)
                      }}
                      className={`relative p-4 rounded-xl border-2 transition-all text-left group ${
                        isSelected
                          ? category.color === 'emerald'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-md ring-1 ring-emerald-200'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md ring-1 ring-blue-200'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      {isSelected && (
                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                          category.color === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}>
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <div className={`mb-2 ${
                        isSelected
                          ? category.color === 'emerald' ? 'text-emerald-600' : 'text-blue-600'
                          : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500'
                      }`}>
                        {report.icon}
                      </div>
                      <h3 className={`font-semibold text-sm mb-1 ${
                        isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                      }`}>
                        {report.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{report.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {report.requiresDateRange && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Rango de fechas
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Excel
                        </span>
                        {report.id === 'trazabilidad' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                            3 hojas
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Panel de configuración y descarga */}
        {selectedReport && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header del panel */}
            <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between ${
              selectedCategory?.color === 'emerald'
                ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}>
              <div className="flex items-center gap-3">
                <div className="text-white/80">{selectedOption?.icon}</div>
                <div>
                  <h2 className="text-white font-bold">{selectedOption?.name}</h2>
                  <p className="text-white/70 text-xs">{selectedOption?.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-white/90 text-xs font-medium bg-white/20 px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Excel Profesional</span>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Rango de fechas */}
              {selectedOption?.requiresDateRange && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rango de Fechas</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Desde</label>
                      <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
                      <input
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Info del reporte */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Incluye en el Excel</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Encabezado corporativo',
                    'Colores institucionales',
                    'Sección de resumen',
                    'Filas alternadas',
                    'Formato moneda COP',
                    selectedReport === 'trazabilidad' ? 'Múltiples hojas' : 'Bordes profesionales',
                  ].map(feature => (
                    <div key={feature} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botón de descarga */}
              <button
                onClick={generateReport}
                disabled={loading}
                className={`w-full sm:w-auto px-8 py-3 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-semibold transition-all shadow-lg ${
                  selectedCategory?.color === 'emerald'
                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-green-200 dark:shadow-green-900/30'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200 dark:shadow-blue-900/30'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Generando reporte...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Descargar Reporte en Excel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Placeholder cuando no hay reporte seleccionado */}
        {!selectedReport && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl p-10 text-center">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-1">Selecciona un reporte</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Elige uno de los reportes de las categorías anteriores para configurarlo y descargarlo en formato Excel profesional.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
