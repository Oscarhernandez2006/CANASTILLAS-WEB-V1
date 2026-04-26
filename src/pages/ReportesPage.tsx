/**
 * @module ReportesPage
 * @description Centro de reportes con múltiples tipos y exportación a PDF/Excel.
 */
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
  | 'demanda_proceso'

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
          description: 'Estado completo: por estado, tamaño/color, propietario, condición e indicadores clave (5 hojas)',
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
          description: 'Detalle completo, análisis por tipo, flujo entre usuarios y traspasos externos (4 hojas)',
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
          description: 'Detalle completo, análisis por cliente, distribución tipo/estado y devoluciones (4 hojas)',
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
          description: 'Ingresos diarios, por cliente, interno vs externo y facturas mensuales (4 hojas)',
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
    {
      id: 'analisis',
      name: 'Análisis & Planificación',
      description: 'Análisis de demanda, capacidad y planificación de inventario por proceso',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'amber',
      reports: [
        {
          id: 'demanda_proceso',
          name: 'Demanda por Proceso',
          description: 'Análisis de demanda vs inventario actual por proceso: promedio diario, pico máximo, inventario recomendado y respaldo de emergencia (3 hojas)',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          requiresDateRange: true,
          permissionKey: 'reportes.inventario',
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
        case 'demanda_proceso': await generateDemandaProcesoReport(); break
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
        .select(`*, current_owner:users!canastillas_current_owner_id_fkey(first_name, last_name, email, role)`)
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('codigo')
      if (error) throw error
      if (!data || data.length === 0) break
      allCanastillas = [...allCanastillas, ...data]
      if (data.length < pageSize) break
      page++
    }

    const statusLabels: Record<string, string> = {
      DISPONIBLE: 'Disponible', EN_ALQUILER: 'En Alquiler', EN_LAVADO: 'En Lavado',
      EN_TRANSITO: 'En Tránsito', EN_RETORNO: 'En Retorno', EN_REPARACION: 'En Reparación',
      FUERA_SERVICIO: 'Fuera de Servicio', EXTRAVIADA: 'Extraviada', DADA_DE_BAJA: 'Dada de Baja',
    }

    const wb = XLSX.utils.book_new()

    // === HOJA 1: INVENTARIO DETALLADO ===
    const h1 = ['#', 'Código', 'Tamaño', 'Color', 'Forma', 'Estado', 'Condición', 'Tipo Propiedad', 'Ubicación', 'Área', 'Propietario Actual', 'Email Propietario', 'Rol Propietario', 'Fecha Registro', 'Antigüedad (días)']
    const d1 = allCanastillas.map((c, i) => {
      const dias = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000)
      return [
        i + 1, c.codigo, c.size, c.color, c.shape || '-',
        statusLabels[c.status] || c.status,
        c.condition === 'BUENA' ? 'Buena' : c.condition === 'REGULAR' ? 'Regular' : c.condition === 'MALA' ? 'Mala' : (c.condition || '-'),
        c.tipo_propiedad === 'PROPIA' ? 'Propia' : 'Alquilada',
        c.current_location || '-', c.current_area || '-',
        c.current_owner ? `${c.current_owner.first_name} ${c.current_owner.last_name}` : 'Sin asignar',
        c.current_owner?.email || '-',
        c.current_owner?.role || '-',
        formatDateDisplay(c.created_at), dias
      ]
    })
    const ws1Data = buildSheetData('Inventario Detallado de Canastillas', h1, d1)
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)
    ws1['!cols'] = [5, 12, 10, 10, 10, 14, 12, 14, 16, 12, 22, 22, 12, 13, 14].map(w => ({ wch: w }))
    applyMerges(ws1, h1.length, d1.length)
    XLSX.utils.book_append_sheet(wb, ws1, 'Inventario Detallado')

    // === HOJA 2: RESUMEN POR ESTADO ===
    const statusCount: Record<string, number> = {}
    allCanastillas.forEach(c => { const l = statusLabels[c.status] || c.status; statusCount[l] = (statusCount[l] || 0) + 1 })
    const h2 = ['Estado', 'Cantidad', '% del Total', 'Observación']
    const total = allCanastillas.length
    const d2 = Object.entries(statusCount).sort((a, b) => b[1] - a[1]).map(([estado, cant]) => {
      const pct = total > 0 ? ((cant / total) * 100).toFixed(1) + '%' : '0%'
      let obs = ''
      if (estado === 'Disponible') obs = 'Listas para operación'
      else if (estado === 'En Alquiler') obs = 'Generando ingresos'
      else if (estado === 'Extraviada' || estado === 'Fuera de Servicio') obs = '⚠️ Requiere atención'
      return [estado, cant, pct, obs]
    })
    d2.push(['TOTAL', total, '100%', ''])
    const ws2Data = buildSheetData('Distribución por Estado', h2, d2, [
      { label: 'Total Canastillas', value: total },
      { label: 'Disponibles', value: statusCount['Disponible'] || 0 },
      { label: 'En operación (alquiler+tránsito+lavado)', value: (statusCount['En Alquiler'] || 0) + (statusCount['En Tránsito'] || 0) + (statusCount['En Lavado'] || 0) },
      { label: 'Tasa de utilización', value: total > 0 ? ((((statusCount['En Alquiler'] || 0)) / total) * 100).toFixed(1) + '%' : '0%' },
      { label: 'Canastillas con problemas', value: (statusCount['Extraviada'] || 0) + (statusCount['Fuera de Servicio'] || 0) + (statusCount['Dada de Baja'] || 0) },
    ])
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)
    ws2['!cols'] = [25, 12, 12, 30].map(w => ({ wch: w }))
    applyMerges(ws2, h2.length, d2.length)
    XLSX.utils.book_append_sheet(wb, ws2, 'Por Estado')

    // === HOJA 3: RESUMEN POR TAMAÑO Y COLOR ===
    const sizeColorMap: Record<string, { total: number; disponibles: number; enAlquiler: number; enLavado: number; otros: number }> = {}
    allCanastillas.forEach(c => {
      const key = `${c.size} - ${c.color}`
      if (!sizeColorMap[key]) sizeColorMap[key] = { total: 0, disponibles: 0, enAlquiler: 0, enLavado: 0, otros: 0 }
      sizeColorMap[key].total++
      if (c.status === 'DISPONIBLE') sizeColorMap[key].disponibles++
      else if (c.status === 'EN_ALQUILER') sizeColorMap[key].enAlquiler++
      else if (c.status === 'EN_LAVADO') sizeColorMap[key].enLavado++
      else sizeColorMap[key].otros++
    })
    const h3 = ['Tamaño - Color', 'Total', 'Disponibles', 'En Alquiler', 'En Lavado', 'Otros', '% Utilización']
    const d3 = Object.entries(sizeColorMap).sort((a, b) => b[1].total - a[1].total).map(([key, v]) => [
      key, v.total, v.disponibles, v.enAlquiler, v.enLavado, v.otros,
      v.total > 0 ? ((v.enAlquiler / v.total) * 100).toFixed(1) + '%' : '0%'
    ])
    const ws3Data = buildSheetData('Distribución por Tamaño y Color', h3, d3)
    const ws3 = XLSX.utils.aoa_to_sheet(ws3Data)
    ws3['!cols'] = [22, 10, 12, 12, 12, 10, 14].map(w => ({ wch: w }))
    applyMerges(ws3, h3.length, d3.length)
    XLSX.utils.book_append_sheet(wb, ws3, 'Por Tamaño-Color')

    // === HOJA 4: RESUMEN POR PROPIETARIO ===
    const ownerMap: Record<string, { nombre: string; total: number; disponibles: number; enAlquiler: number; otros: number }> = {}
    allCanastillas.forEach(c => {
      const ownerName = c.current_owner ? `${c.current_owner.first_name} ${c.current_owner.last_name}` : 'Sin asignar'
      if (!ownerMap[ownerName]) ownerMap[ownerName] = { nombre: ownerName, total: 0, disponibles: 0, enAlquiler: 0, otros: 0 }
      ownerMap[ownerName].total++
      if (c.status === 'DISPONIBLE') ownerMap[ownerName].disponibles++
      else if (c.status === 'EN_ALQUILER') ownerMap[ownerName].enAlquiler++
      else ownerMap[ownerName].otros++
    })
    const h4 = ['Propietario', 'Total Canastillas', 'Disponibles', 'En Alquiler', 'Otros', '% del Inventario']
    const d4 = Object.values(ownerMap).sort((a, b) => b.total - a.total).map(v => [
      v.nombre, v.total, v.disponibles, v.enAlquiler, v.otros,
      total > 0 ? ((v.total / total) * 100).toFixed(1) + '%' : '0%'
    ])
    const ws4Data = buildSheetData('Distribución por Propietario', h4, d4)
    const ws4 = XLSX.utils.aoa_to_sheet(ws4Data)
    ws4['!cols'] = [28, 16, 12, 12, 10, 14].map(w => ({ wch: w }))
    applyMerges(ws4, h4.length, d4.length)
    XLSX.utils.book_append_sheet(wb, ws4, 'Por Propietario')

    // === HOJA 5: RESUMEN POR CONDICIÓN ===
    const condMap: Record<string, number> = {}
    allCanastillas.forEach(c => {
      const cond = c.condition === 'BUENA' ? 'Buena' : c.condition === 'REGULAR' ? 'Regular' : c.condition === 'MALA' ? 'Mala' : (c.condition || 'Sin dato')
      condMap[cond] = (condMap[cond] || 0) + 1
    })
    const propiaCount = allCanastillas.filter(c => c.tipo_propiedad === 'PROPIA').length
    const h5 = ['Indicador', 'Valor', 'Detalle']
    const d5: any[][] = [
      ['Total de Canastillas', total, 'Inventario completo'],
      ['Propias', propiaCount, `${total > 0 ? ((propiaCount / total) * 100).toFixed(1) : 0}% del total`],
      ['Alquiladas (de terceros)', total - propiaCount, `${total > 0 ? (((total - propiaCount) / total) * 100).toFixed(1) : 0}% del total`],
      ['', '', ''],
      ['CONDICIÓN', '', ''],
      ...Object.entries(condMap).sort((a, b) => b[1] - a[1]).map(([c, n]) => [c, n, `${total > 0 ? ((n / total) * 100).toFixed(1) : 0}%`]),
      ['', '', ''],
      ['INDICADORES CLAVE', '', ''],
      ['Tasa de utilización', `${total > 0 ? (((statusCount['En Alquiler'] || 0) / total) * 100).toFixed(1) : 0}%`, 'Canastillas generando ingresos / Total'],
      ['Tasa de disponibilidad', `${total > 0 ? (((statusCount['Disponible'] || 0) / total) * 100).toFixed(1) : 0}%`, 'Canastillas listas / Total'],
      ['Tasa de pérdida/baja', `${total > 0 ? ((((statusCount['Extraviada'] || 0) + (statusCount['Dada de Baja'] || 0)) / total) * 100).toFixed(1) : 0}%`, 'Canastillas perdidas o de baja / Total'],
    ]
    const ws5Data = buildSheetData('Indicadores y Análisis del Inventario', h5, d5)
    const ws5 = XLSX.utils.aoa_to_sheet(ws5Data)
    ws5['!cols'] = [30, 16, 40].map(w => ({ wch: w }))
    applyMerges(ws5, h5.length, d5.length)
    XLSX.utils.book_append_sheet(wb, ws5, 'Indicadores')

    exportExcel(wb, 'Inventario_Canastillas')
  }

  const generateAlquileresReport = async () => {
    const { data, error } = await supabase
      .from('rentals')
      .select(`*, sale_point:sale_points(name, code, city, contact_name, identification), rental_items(id), rental_returns(id, amount, return_date, days_charged, invoice_number)`)
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin + 'T23:59:59')
      .order('created_at', { ascending: false })
    if (error) throw error
    if (!data || data.length === 0) { setError('No hay alquileres en el período seleccionado'); return }

    const statusLabels: Record<string, string> = { ACTIVO: 'Activo', RETORNADO: 'Retornado', CANCELADO: 'Cancelado', VENCIDO: 'Vencido', PENDIENTE_FIRMA: 'Pend. Firma' }
    const wb = XLSX.utils.book_new()

    // === HOJA 1: DETALLE COMPLETO ===
    const h1 = ['#', 'N° Remisión', 'Cliente', 'NIT/CC', 'Ciudad', 'Contacto', 'Tipo', 'Estado', 'Fecha Inicio', 'Fecha Devolución Est.', 'Fecha Devolución Real', 'Días Estimados', 'Días Reales', 'Tarifa Diaria', 'Monto Total', 'Total Facturado', 'Canastillas', 'Devueltas', 'Pendientes', 'N° Devoluciones']
    const d1 = data.map((r, i) => {
      const returned = r.returned_items_count || 0
      const pending = r.pending_items_count || (r.rental_items?.length || 0) - returned
      return [
        i + 1, r.remision_number || 'N/A',
        r.sale_point?.name || 'N/A', r.sale_point?.identification || '-', r.sale_point?.city || '-', r.sale_point?.contact_name || '-',
        r.rental_type === 'INTERNO' ? 'Interno' : 'Externo', statusLabels[r.status] || r.status,
        formatDateDisplay(r.start_date), formatDateDisplay(r.estimated_return_date), formatDateDisplay(r.actual_return_date),
        r.estimated_days || 0, r.actual_days || 0, r.daily_rate || 0,
        r.total_amount || 0, r.total_invoiced || 0,
        r.rental_items?.length || 0, returned, pending, r.rental_returns?.length || 0
      ]
    })
    const ws1Data = buildSheetData('Detalle Completo de Alquileres', h1, d1)
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)
    ws1['!cols'] = [5, 14, 22, 14, 12, 18, 10, 12, 13, 13, 13, 10, 10, 12, 14, 14, 11, 11, 11, 12].map(w => ({ wch: w }))
    applyMerges(ws1, h1.length, d1.length)
    XLSX.utils.book_append_sheet(wb, ws1, 'Detalle Alquileres')

    // === HOJA 2: RESUMEN POR CLIENTE ===
    const clientMap: Record<string, { nombre: string; ciudad: string; nit: string; alquileres: number; canastillas: number; monto: number; devueltas: number; pendientes: number; activos: number; retornados: number }> = {}
    data.forEach(r => {
      const name = r.sale_point?.name || 'Sin cliente'
      if (!clientMap[name]) clientMap[name] = { nombre: name, ciudad: r.sale_point?.city || '-', nit: r.sale_point?.identification || '-', alquileres: 0, canastillas: 0, monto: 0, devueltas: 0, pendientes: 0, activos: 0, retornados: 0 }
      clientMap[name].alquileres++
      clientMap[name].canastillas += r.rental_items?.length || 0
      clientMap[name].monto += r.total_amount || 0
      clientMap[name].devueltas += r.returned_items_count || 0
      clientMap[name].pendientes += r.pending_items_count || 0
      if (r.status === 'ACTIVO') clientMap[name].activos++
      if (r.status === 'RETORNADO') clientMap[name].retornados++
    })
    const h2 = ['Cliente', 'NIT/CC', 'Ciudad', 'Total Alquileres', 'Activos', 'Retornados', 'Canastillas Totales', 'Devueltas', 'Pendientes', 'Monto Total', '% Ingresos']
    const totalMonto = data.reduce((s, r) => s + (r.total_amount || 0), 0)
    const d2 = Object.values(clientMap).sort((a, b) => b.monto - a.monto).map(c => [
      c.nombre, c.nit, c.ciudad, c.alquileres, c.activos, c.retornados, c.canastillas, c.devueltas, c.pendientes,
      c.monto, totalMonto > 0 ? ((c.monto / totalMonto) * 100).toFixed(1) + '%' : '0%'
    ])
    const ws2Data = buildSheetData('Análisis por Cliente', h2, d2, [
      { label: 'Total Clientes', value: Object.keys(clientMap).length },
      { label: 'Clientes con alquileres activos', value: Object.values(clientMap).filter(c => c.activos > 0).length },
      { label: 'Cliente con mayor facturación', value: Object.values(clientMap).sort((a, b) => b.monto - a.monto)[0]?.nombre || '-' },
    ])
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)
    ws2['!cols'] = [25, 14, 14, 14, 10, 12, 16, 11, 11, 14, 12].map(w => ({ wch: w }))
    applyMerges(ws2, h2.length, d2.length)
    XLSX.utils.book_append_sheet(wb, ws2, 'Por Cliente')

    // === HOJA 3: RESUMEN POR TIPO Y ESTADO ===
    const tipoMap: Record<string, Record<string, number>> = {}
    data.forEach(r => {
      const tipo = r.rental_type === 'INTERNO' ? 'Interno' : 'Externo'
      const estado = statusLabels[r.status] || r.status
      if (!tipoMap[tipo]) tipoMap[tipo] = {}
      tipoMap[tipo][estado] = (tipoMap[tipo][estado] || 0) + 1
    })
    const allStatuses = [...new Set(data.map(r => statusLabels[r.status] || r.status))]
    const h3 = ['Tipo', ...allStatuses, 'Total']
    const d3 = Object.entries(tipoMap).map(([tipo, estados]) => {
      const rowTotal = Object.values(estados).reduce((s, v) => s + v, 0)
      return [tipo, ...allStatuses.map(s => estados[s] || 0), rowTotal]
    })
    const activos = data.filter(r => r.status === 'ACTIVO').length
    const retornados = data.filter(r => r.status === 'RETORNADO').length
    const totalCan = data.reduce((s, r) => s + (r.rental_items?.length || 0), 0)
    const ws3Data = buildSheetData('Distribución por Tipo y Estado', h3, d3, [
      { label: 'Total Alquileres', value: data.length },
      { label: 'Activos', value: activos },
      { label: 'Retornados', value: retornados },
      { label: 'Total Canastillas Alquiladas', value: totalCan },
      { label: 'Ingresos Totales', value: `$${totalMonto.toLocaleString()}` },
      { label: 'Promedio por Alquiler', value: data.length > 0 ? `$${Math.round(totalMonto / data.length).toLocaleString()}` : '$0' },
      { label: 'Promedio Canastillas/Alquiler', value: data.length > 0 ? Math.round(totalCan / data.length) : 0 },
      { label: 'Tarifa Promedio', value: data.length > 0 ? `$${Math.round(data.reduce((s, r) => s + (r.daily_rate || 0), 0) / data.length).toLocaleString()}` : '$0' },
    ])
    const ws3 = XLSX.utils.aoa_to_sheet(ws3Data)
    ws3['!cols'] = [14, ...allStatuses.map(() => 12), 10].map(w => ({ wch: w }))
    applyMerges(ws3, h3.length, d3.length)
    XLSX.utils.book_append_sheet(wb, ws3, 'Tipo y Estado')

    // === HOJA 4: HISTORIAL DE DEVOLUCIONES ===
    const allReturns: any[] = []
    data.forEach(r => {
      (r.rental_returns || []).forEach((ret: any) => {
        allReturns.push({ ...ret, remision: r.remision_number, cliente: r.sale_point?.name || 'N/A' })
      })
    })
    if (allReturns.length > 0) {
      const h4 = ['#', 'Remisión Alquiler', 'Cliente', 'N° Factura Devolución', 'Fecha Devolución', 'Días Cobrados', 'Monto']
      const d4 = allReturns.sort((a, b) => new Date(b.return_date || 0).getTime() - new Date(a.return_date || 0).getTime())
        .map((ret, i) => [i + 1, ret.remision, ret.cliente, ret.invoice_number || '-', formatDateDisplay(ret.return_date), ret.days_charged || 0, ret.amount || 0])
      const totalDevuelto = allReturns.reduce((s, r) => s + (r.amount || 0), 0)
      const ws4Data = buildSheetData('Historial de Devoluciones', h4, d4, [
        { label: 'Total Devoluciones', value: allReturns.length },
        { label: 'Total Facturado en Devoluciones', value: `$${totalDevuelto.toLocaleString()}` },
      ])
      const ws4 = XLSX.utils.aoa_to_sheet(ws4Data)
      ws4['!cols'] = [5, 14, 22, 18, 14, 14, 14].map(w => ({ wch: w }))
      applyMerges(ws4, h4.length, d4.length)
      XLSX.utils.book_append_sheet(wb, ws4, 'Devoluciones')
    }

    exportExcel(wb, 'Reporte_Alquileres')
  }

  const generateTraspasosReport = async () => {
    const { data, error } = await supabase
      .from('transfers')
      .select(`
        *,
        from_user:users!transfers_from_user_id_fkey(first_name, last_name, email),
        to_user:users!transfers_to_user_id_fkey(first_name, last_name, email),
        transfer_items(id, canastilla:canastillas(codigo, size, color))
      `)
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin + 'T23:59:59')
      .order('created_at', { ascending: false })
    if (error) throw error
    if (!data || data.length === 0) { setError('No hay traspasos en el período seleccionado'); return }

    const statusLabels: Record<string, string> = { PENDIENTE: 'Pendiente', ACEPTADO: 'Aceptado', RECHAZADO: 'Rechazado', DEVUELTO: 'Devuelto', DEVUELTO_PARCIAL: 'Dev. Parcial' }
    const wb = XLSX.utils.book_new()

    // === HOJA 1: DETALLE COMPLETO DE TRASPASOS ===
    const h1 = ['#', 'N° Remisión', 'Tipo', 'Estado', 'Fecha Solicitud', 'Fecha Respuesta', 'Origen', 'Email Origen', 'Destino', 'Destinatario Ext.', 'Empresa Ext.', 'Canastillas', 'Devueltas', 'Pendientes', 'Motivo', 'Notas']
    const d1 = data.map((t, i) => [
      i + 1, t.remision_number || 'N/A',
      t.is_external_transfer ? 'Externo' : t.is_washing_transfer ? 'Lavado' : 'Interno',
      statusLabels[t.status] || t.status,
      formatDateDisplay(t.requested_at || t.created_at), formatDateDisplay(t.responded_at),
      t.from_user ? `${t.from_user.first_name} ${t.from_user.last_name}` : 'N/A',
      t.from_user?.email || '-',
      t.is_external_transfer ? (t.external_recipient_name || 'Externo') : t.to_user ? `${t.to_user.first_name} ${t.to_user.last_name}` : 'N/A',
      t.external_recipient_name || '-', t.external_recipient_empresa || '-',
      t.transfer_items?.length || t.items_count || 0,
      t.returned_items_count || 0, t.pending_items_count || 0,
      t.reason || '-', t.notes || '-'
    ])
    const ws1Data = buildSheetData('Detalle Completo de Traspasos', h1, d1)
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)
    ws1['!cols'] = [5, 14, 10, 12, 13, 13, 22, 22, 22, 18, 18, 11, 11, 11, 25, 25].map(w => ({ wch: w }))
    applyMerges(ws1, h1.length, d1.length)
    XLSX.utils.book_append_sheet(wb, ws1, 'Detalle Traspasos')

    // === HOJA 2: ANÁLISIS POR TIPO ===
    const tipos = { Interno: data.filter(t => !t.is_external_transfer && !t.is_washing_transfer), Externo: data.filter(t => t.is_external_transfer), Lavado: data.filter(t => t.is_washing_transfer) }
    const h2 = ['Tipo de Traspaso', 'Total', 'Pendientes', 'Aceptados', 'Rechazados', 'Devueltos', 'Dev. Parcial', 'Total Canastillas', '% del Total']
    const d2 = Object.entries(tipos).map(([tipo, arr]) => [
      tipo, arr.length,
      arr.filter(t => t.status === 'PENDIENTE').length, arr.filter(t => t.status === 'ACEPTADO').length,
      arr.filter(t => t.status === 'RECHAZADO').length, arr.filter(t => t.status === 'DEVUELTO').length,
      arr.filter(t => t.status === 'DEVUELTO_PARCIAL').length,
      arr.reduce((s, t) => s + (t.transfer_items?.length || t.items_count || 0), 0),
      data.length > 0 ? ((arr.length / data.length) * 100).toFixed(1) + '%' : '0%'
    ])
    const totalCanTraspasos = data.reduce((s, t) => s + (t.transfer_items?.length || t.items_count || 0), 0)
    const ws2Data = buildSheetData('Análisis por Tipo de Traspaso', h2, d2, [
      { label: 'Total Traspasos', value: data.length },
      { label: 'Total Canastillas Movidas', value: totalCanTraspasos },
      { label: 'Tasa de Aceptación', value: data.length > 0 ? ((data.filter(t => t.status === 'ACEPTADO' || t.status === 'DEVUELTO' || t.status === 'DEVUELTO_PARCIAL').length / data.length) * 100).toFixed(1) + '%' : '0%' },
      { label: 'Tasa de Rechazo', value: data.length > 0 ? ((data.filter(t => t.status === 'RECHAZADO').length / data.length) * 100).toFixed(1) + '%' : '0%' },
    ])
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)
    ws2['!cols'] = [18, 10, 12, 12, 12, 12, 12, 16, 12].map(w => ({ wch: w }))
    applyMerges(ws2, h2.length, d2.length)
    XLSX.utils.book_append_sheet(wb, ws2, 'Por Tipo')

    // === HOJA 3: FLUJO DE CANASTILLAS ENTRE USUARIOS ===
    const flowMap: Record<string, { origen: string; destino: string; cantidad: number; traspasos: number }> = {}
    data.forEach(t => {
      const orig = t.from_user ? `${t.from_user.first_name} ${t.from_user.last_name}` : 'N/A'
      const dest = t.is_external_transfer ? (t.external_recipient_empresa || t.external_recipient_name || 'Externo') : t.to_user ? `${t.to_user.first_name} ${t.to_user.last_name}` : 'N/A'
      const key = `${orig} → ${dest}`
      if (!flowMap[key]) flowMap[key] = { origen: orig, destino: dest, cantidad: 0, traspasos: 0 }
      flowMap[key].cantidad += t.transfer_items?.length || t.items_count || 0
      flowMap[key].traspasos++
    })
    const h3 = ['#', 'Origen', 'Destino', 'N° Traspasos', 'Total Canastillas', 'Promedio por Traspaso']
    const d3 = Object.values(flowMap).sort((a, b) => b.cantidad - a.cantidad).map((f, i) => [
      i + 1, f.origen, f.destino, f.traspasos, f.cantidad, f.traspasos > 0 ? Math.round(f.cantidad / f.traspasos) : 0
    ])
    const ws3Data = buildSheetData('Flujo de Canastillas entre Usuarios/Clientes', h3, d3)
    const ws3 = XLSX.utils.aoa_to_sheet(ws3Data)
    ws3['!cols'] = [5, 25, 25, 14, 16, 18].map(w => ({ wch: w }))
    applyMerges(ws3, h3.length, d3.length)
    XLSX.utils.book_append_sheet(wb, ws3, 'Flujo Canastillas')

    // === HOJA 4: TRASPASOS EXTERNOS DETALLADOS ===
    const externos = data.filter(t => t.is_external_transfer)
    if (externos.length > 0) {
      const h4 = ['#', 'N° Remisión', 'Fecha', 'Estado', 'Empresa/Cliente Destino', 'Contacto', 'Cédula Receptor', 'Teléfono', 'Canastillas', 'Devueltas', 'Pendientes', 'Motivo']
      const d4 = externos.map((t, i) => [
        i + 1, t.remision_number || 'N/A', formatDateDisplay(t.requested_at || t.created_at), statusLabels[t.status] || t.status,
        t.external_recipient_empresa || '-', t.external_recipient_name || '-', t.external_recipient_cedula || '-', t.external_recipient_phone || '-',
        t.transfer_items?.length || t.items_count || 0, t.returned_items_count || 0, t.pending_items_count || 0, t.reason || '-'
      ])
      const ws4Data = buildSheetData('Traspasos Externos Detallados', h4, d4, [
        { label: 'Total Traspasos Externos', value: externos.length },
        { label: 'Canastillas en exterior', value: externos.reduce((s, t) => s + (t.pending_items_count || 0), 0) },
        { label: 'Canastillas devueltas', value: externos.reduce((s, t) => s + (t.returned_items_count || 0), 0) },
      ])
      const ws4 = XLSX.utils.aoa_to_sheet(ws4Data)
      ws4['!cols'] = [5, 14, 13, 12, 22, 18, 14, 14, 11, 11, 11, 25].map(w => ({ wch: w }))
      applyMerges(ws4, h4.length, d4.length)
      XLSX.utils.book_append_sheet(wb, ws4, 'Externos')
    }

    exportExcel(wb, 'Reporte_Traspasos')
  }

  const generateIngresosReport = async () => {
    // Cargar alquileres retornados + activos en el período
    const { data: retornados, error: e1 } = await supabase
      .from('rentals')
      .select('*, sale_point:sale_points(name, city, identification), rental_items(id), rental_returns(id, amount, return_date, days_charged)')
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin + 'T23:59:59')
    if (e1) throw e1

    // Cargar facturas mensuales del período
    const { data: facturas, error: e2 } = await supabase
      .from('monthly_invoices')
      .select('*, sale_point:sale_points(name, city)')
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin + 'T23:59:59')
    if (e2) throw e2

    const allRentals = retornados || []
    const allFacturas = facturas || []
    if (allRentals.length === 0 && allFacturas.length === 0) { setError('No hay datos de ingresos en el período seleccionado'); return }

    const wb = XLSX.utils.book_new()

    // === HOJA 1: INGRESOS DIARIOS ===
    const groupedByDate: Record<string, { ingresos: number; alquileres: number; canastillas: number; retornos: number }> = {}
    allRentals.forEach(r => {
      const returns = r.rental_returns || []
      returns.forEach((ret: any) => {
        const fecha = formatDateDisplay(ret.return_date)
        if (!groupedByDate[fecha]) groupedByDate[fecha] = { ingresos: 0, alquileres: 0, canastillas: 0, retornos: 0 }
        groupedByDate[fecha].ingresos += ret.amount || 0
        groupedByDate[fecha].retornos++
      })
      if (returns.length === 0 && r.total_amount) {
        const fecha = formatDateDisplay(r.actual_return_date || r.start_date)
        if (!groupedByDate[fecha]) groupedByDate[fecha] = { ingresos: 0, alquileres: 0, canastillas: 0, retornos: 0 }
        groupedByDate[fecha].ingresos += r.total_amount || 0
      }
      const fecha = formatDateDisplay(r.start_date)
      if (!groupedByDate[fecha]) groupedByDate[fecha] = { ingresos: 0, alquileres: 0, canastillas: 0, retornos: 0 }
      groupedByDate[fecha].alquileres++
      groupedByDate[fecha].canastillas += r.rental_items?.length || 0
    })
    const sorted = Object.entries(groupedByDate).sort((a, b) => a[0].split('/').reverse().join('-').localeCompare(b[0].split('/').reverse().join('-')))
    const h1 = ['#', 'Fecha', 'Ingresos del Día', 'Alquileres Creados', 'Canastillas', 'Devoluciones', 'Promedio por Operación']
    const d1 = sorted.map(([fecha, d], i) => [
      i + 1, fecha, d.ingresos, d.alquileres, d.canastillas, d.retornos,
      (d.alquileres + d.retornos) > 0 ? Math.round(d.ingresos / (d.alquileres + d.retornos)) : 0
    ])
    const totalIngresos = Object.values(groupedByDate).reduce((s, d) => s + d.ingresos, 0)
    const diasConDatos = Object.keys(groupedByDate).length
    const ws1Data = buildSheetData('Análisis de Ingresos Diarios', h1, d1, [
      { label: 'Ingresos Totales', value: `$${totalIngresos.toLocaleString()}` },
      { label: 'Promedio Diario', value: diasConDatos > 0 ? `$${Math.round(totalIngresos / diasConDatos).toLocaleString()}` : '$0' },
      { label: 'Mejor día', value: sorted.length > 0 ? sorted.sort((a, b) => b[1].ingresos - a[1].ingresos)[0][0] + ` ($${sorted.sort((a, b) => b[1].ingresos - a[1].ingresos)[0][1].ingresos.toLocaleString()})` : '-' },
      { label: 'Días con actividad', value: diasConDatos },
    ])
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)
    ws1['!cols'] = [5, 14, 16, 16, 12, 14, 18].map(w => ({ wch: w }))
    applyMerges(ws1, h1.length, d1.length)
    XLSX.utils.book_append_sheet(wb, ws1, 'Ingresos Diarios')

    // === HOJA 2: INGRESOS POR CLIENTE ===
    const clientIngMap: Record<string, { nombre: string; ciudad: string; nit: string; ingresos: number; alquileres: number; canastillas: number }> = {}
    allRentals.forEach(r => {
      const name = r.sale_point?.name || 'Sin cliente'
      if (!clientIngMap[name]) clientIngMap[name] = { nombre: name, ciudad: r.sale_point?.city || '-', nit: r.sale_point?.identification || '-', ingresos: 0, alquileres: 0, canastillas: 0 }
      clientIngMap[name].ingresos += r.total_amount || 0
      clientIngMap[name].alquileres++
      clientIngMap[name].canastillas += r.rental_items?.length || 0
    })
    const h2 = ['#', 'Cliente', 'NIT/CC', 'Ciudad', 'Alquileres', 'Canastillas', 'Ingresos', '% del Total', 'Promedio por Alquiler']
    const totalIng2 = Object.values(clientIngMap).reduce((s, c) => s + c.ingresos, 0)
    const d2 = Object.values(clientIngMap).sort((a, b) => b.ingresos - a.ingresos).map((c, i) => [
      i + 1, c.nombre, c.nit, c.ciudad, c.alquileres, c.canastillas, c.ingresos,
      totalIng2 > 0 ? ((c.ingresos / totalIng2) * 100).toFixed(1) + '%' : '0%',
      c.alquileres > 0 ? Math.round(c.ingresos / c.alquileres) : 0
    ])
    const ws2Data = buildSheetData('Ingresos por Cliente', h2, d2, [
      { label: 'Total Clientes', value: Object.keys(clientIngMap).length },
      { label: 'Ingreso Total', value: `$${totalIng2.toLocaleString()}` },
      { label: 'Cliente Top', value: Object.values(clientIngMap).sort((a, b) => b.ingresos - a.ingresos)[0]?.nombre || '-' },
    ])
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)
    ws2['!cols'] = [5, 22, 14, 14, 12, 12, 14, 12, 16].map(w => ({ wch: w }))
    applyMerges(ws2, h2.length, d2.length)
    XLSX.utils.book_append_sheet(wb, ws2, 'Por Cliente')

    // === HOJA 3: INGRESOS POR TIPO (INTERNO vs EXTERNO) ===
    const tipoIng: Record<string, { ingresos: number; count: number; canastillas: number }> = {}
    allRentals.forEach(r => {
      const tipo = r.rental_type === 'INTERNO' ? 'Interno' : 'Externo'
      if (!tipoIng[tipo]) tipoIng[tipo] = { ingresos: 0, count: 0, canastillas: 0 }
      tipoIng[tipo].ingresos += r.total_amount || 0
      tipoIng[tipo].count++
      tipoIng[tipo].canastillas += r.rental_items?.length || 0
    })
    const h3 = ['Tipo', 'Alquileres', 'Canastillas', 'Ingresos', '% Ingresos', 'Promedio por Alquiler', 'Ingreso por Canastilla']
    const d3 = Object.entries(tipoIng).map(([tipo, v]) => [
      tipo, v.count, v.canastillas, v.ingresos,
      totalIng2 > 0 ? ((v.ingresos / totalIng2) * 100).toFixed(1) + '%' : '0%',
      v.count > 0 ? Math.round(v.ingresos / v.count) : 0,
      v.canastillas > 0 ? Math.round(v.ingresos / v.canastillas) : 0
    ])
    const ws3Data = buildSheetData('Comparativa Interno vs Externo', h3, d3)
    const ws3 = XLSX.utils.aoa_to_sheet(ws3Data)
    ws3['!cols'] = [14, 12, 12, 14, 12, 18, 18].map(w => ({ wch: w }))
    applyMerges(ws3, h3.length, d3.length)
    XLSX.utils.book_append_sheet(wb, ws3, 'Interno vs Externo')

    // === HOJA 4: FACTURAS MENSUALES ===
    if (allFacturas.length > 0) {
      const h4 = ['#', 'N° Factura', 'Cliente', 'Ciudad', 'Período', 'Subtotal', 'Descuento', 'Total', 'Estado', 'Fecha Cierre']
      const d4 = allFacturas.sort((a: any, b: any) => (b.total_amount || 0) - (a.total_amount || 0)).map((f: any, i: number) => [
        i + 1, f.invoice_number || '-', f.sale_point?.name || '-', f.sale_point?.city || '-',
        `${f.billing_month}/${f.billing_year}`,
        (f.total_amount || 0) + (f.discount || 0), f.discount || 0, f.total_amount || 0,
        f.closed_at ? 'Cerrada' : 'Abierta', f.closed_at ? formatDateDisplay(f.closed_at) : '-'
      ])
      const totalFact = allFacturas.reduce((s: number, f: any) => s + (f.total_amount || 0), 0)
      const ws4Data = buildSheetData('Facturas Mensuales Generadas', h4, d4, [
        { label: 'Total Facturas', value: allFacturas.length },
        { label: 'Total Facturado', value: `$${totalFact.toLocaleString()}` },
        { label: 'Cerradas', value: allFacturas.filter((f: any) => f.closed_at).length },
        { label: 'Abiertas', value: allFacturas.filter((f: any) => !f.closed_at).length },
      ])
      const ws4 = XLSX.utils.aoa_to_sheet(ws4Data)
      ws4['!cols'] = [5, 14, 22, 14, 12, 14, 12, 14, 10, 14].map(w => ({ wch: w }))
      applyMerges(ws4, h4.length, d4.length)
      XLSX.utils.book_append_sheet(wb, ws4, 'Facturas Mensuales')
    }

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

  // ========== REPORTE DEMANDA POR PROCESO ==========
  const generateDemandaProcesoReport = async () => {
    const BUFFER_EMERGENCIA = 0.20 // 20% extra para emergencias

    // 1. Obtener todos los usuarios activos con department
    const { data: usersData, error: usersErr } = await supabase
      .from('users')
      .select('id, first_name, last_name, department, role')
      .eq('is_active', true)
      .not('department', 'is', null)
    if (usersErr) throw usersErr
    const users = usersData || []

    // Agrupar por departamento
    const deptUsers: Record<string, typeof users> = {}
    users.forEach(u => {
      const dept = u.department?.trim() || 'SIN ASIGNAR'
      if (!deptUsers[dept]) deptUsers[dept] = []
      deptUsers[dept].push(u)
    })
    const departamentos = Object.keys(deptUsers).sort()

    // 2. Obtener inventario actual por propietario
    let allCanastillas: any[] = []
    let page = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from('canastillas')
        .select('id, status, current_owner_id')
        .range(page * pageSize, (page + 1) * pageSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      allCanastillas = [...allCanastillas, ...data]
      if (data.length < pageSize) break
      page++
    }

    // Mapa userId -> departamento
    const userDeptMap: Record<string, string> = {}
    users.forEach(u => { userDeptMap[u.id] = u.department?.trim() || 'SIN ASIGNAR' })

    // Inventario actual por departamento
    const invActualPorDept: Record<string, { total: number; disponibles: number }> = {}
    allCanastillas.forEach(c => {
      const dept = userDeptMap[c.current_owner_id] || 'SIN ASIGNAR'
      if (!invActualPorDept[dept]) invActualPorDept[dept] = { total: 0, disponibles: 0 }
      invActualPorDept[dept].total++
      if (c.status === 'DISPONIBLE') invActualPorDept[dept].disponibles++
    })

    // 3. Obtener traspasos del rango de fechas seleccionado
    const startDate = `${fechaInicio}T00:00:00`
    const endDate = `${fechaFin}T23:59:59`

    let allTransfers: any[] = []
    let tPage = 0
    while (true) {
      const { data, error } = await supabase
        .from('transfers')
        .select('id, from_user_id, to_user_id, status, requested_at, responded_at, remision_number')
        .or(`status.eq.ACEPTADO,status.eq.ACEPTADO_AUTO`)
        .gte('requested_at', startDate)
        .lte('requested_at', endDate)
        .not('remision_number', 'is', null)
        .range(tPage * pageSize, (tPage + 1) * pageSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      allTransfers = [...allTransfers, ...data]
      if (data.length < pageSize) break
      tPage++
    }

    // Contar items por transfer
    const transferItemCounts: Record<string, number> = {}
    await Promise.all(
      allTransfers.map(async (t) => {
        const { count } = await supabase
          .from('transfer_items')
          .select('*', { count: 'exact', head: true })
          .eq('transfer_id', t.id)
        transferItemCounts[t.id] = count || 0
      })
    )

    // 4. Calcular entradas/salidas diarias por departamento
    const diasRango = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))

    // Estructura: dept -> { dia -> { entradas, salidas } }
    const flujoDiario: Record<string, Record<string, { entradas: number; salidas: number }>> = {}

    for (const t of allTransfers) {
      const count = transferItemCounts[t.id] || 0
      if (count === 0) continue

      const fromDept = userDeptMap[t.from_user_id] || 'EXTERNO'
      const toDept = userDeptMap[t.to_user_id] || 'EXTERNO'
      const dia = new Date(t.requested_at).toISOString().split('T')[0]

      // Salida del proceso origen
      if (fromDept !== 'EXTERNO') {
        if (!flujoDiario[fromDept]) flujoDiario[fromDept] = {}
        if (!flujoDiario[fromDept][dia]) flujoDiario[fromDept][dia] = { entradas: 0, salidas: 0 }
        flujoDiario[fromDept][dia].salidas += count
      }

      // Entrada al proceso destino
      if (toDept !== 'EXTERNO') {
        if (!flujoDiario[toDept]) flujoDiario[toDept] = {}
        if (!flujoDiario[toDept][dia]) flujoDiario[toDept][dia] = { entradas: 0, salidas: 0 }
        flujoDiario[toDept][dia].entradas += count
      }
    }

    // 5. Calcular estadísticas por departamento
    interface DeptStats {
      departamento: string
      usuarios: number
      inventarioActual: number
      disponiblesActual: number
      promedioEntradasDia: number
      promedioSalidasDia: number
      picoMaxEntradas: number
      picoMaxSalidas: number
      demandaPromedio: number
      inventarioRecomendado: number
      respaldoEmergencia: number
      inventarioIdeal: number
      deficit: number
      estado: string
    }

    const stats: DeptStats[] = departamentos.map(dept => {
      const flujo = flujoDiario[dept] || {}
      const dias = Object.values(flujo)
      const inv = invActualPorDept[dept] || { total: 0, disponibles: 0 }
      const numUsuarios = deptUsers[dept]?.length || 0

      const totalEntradas = dias.reduce((s, d) => s + d.entradas, 0)
      const totalSalidas = dias.reduce((s, d) => s + d.salidas, 0)
      const picoMaxEntradas = dias.length > 0 ? Math.max(...dias.map(d => d.entradas)) : 0
      const picoMaxSalidas = dias.length > 0 ? Math.max(...dias.map(d => d.salidas)) : 0

      const promedioEntradasDia = Math.round(totalEntradas / diasRango)
      const promedioSalidasDia = Math.round(totalSalidas / diasRango)

      // La demanda promedio es lo que el proceso necesita para operar (el mayor entre lo que entra y sale)
      const demandaPromedio = Math.max(promedioEntradasDia, promedioSalidasDia)
      // Inventario recomendado: cubrir al menos el pico máximo diario
      const inventarioRecomendado = Math.max(picoMaxSalidas, picoMaxEntradas, demandaPromedio)
      // Respaldo de emergencia: 20% adicional sobre el recomendado
      const respaldoEmergencia = Math.ceil(inventarioRecomendado * BUFFER_EMERGENCIA)
      // Inventario ideal = recomendado + respaldo
      const inventarioIdeal = inventarioRecomendado + respaldoEmergencia
      // Déficit o superávit
      const deficit = inv.total - inventarioIdeal

      let estado = ''
      if (inv.total === 0 && inventarioIdeal === 0) estado = '⚪ Sin actividad'
      else if (deficit >= respaldoEmergencia) estado = '🟢 Óptimo (con respaldo)'
      else if (deficit >= 0) estado = '🟡 Justo (sin margen)'
      else if (deficit > -respaldoEmergencia) estado = '🟠 Déficit leve'
      else estado = '🔴 Déficit crítico'

      return {
        departamento: dept,
        usuarios: numUsuarios,
        inventarioActual: inv.total,
        disponiblesActual: inv.disponibles,
        promedioEntradasDia,
        promedioSalidasDia,
        picoMaxEntradas,
        picoMaxSalidas,
        demandaPromedio,
        inventarioRecomendado,
        respaldoEmergencia,
        inventarioIdeal,
        deficit,
        estado,
      }
    })

    // Filtrar solo los que tienen actividad o inventario
    const statsConActividad = stats.filter(s => s.inventarioActual > 0 || s.demandaPromedio > 0)

    // ========== CREAR EXCEL ==========
    const wb = XLSX.utils.book_new()
    const dateRange = `${formatDateDisplay(fechaInicio)} - ${formatDateDisplay(fechaFin)} (${diasRango} días)`

    // === HOJA 1: RESUMEN POR PROCESO ===
    const h1 = ['#', 'Proceso/Departamento', 'Usuarios', 'Inventario Actual', 'Disponibles', 'Prom. Entradas/Día', 'Prom. Salidas/Día', 'Pico Máx. Salidas', 'Demanda Promedio', 'Inv. Recomendado', 'Respaldo Emergencia (+20%)', 'Inventario Ideal', 'Diferencia', 'Estado']
    const d1 = statsConActividad.map((s, i) => [
      i + 1, s.departamento, s.usuarios, s.inventarioActual, s.disponiblesActual,
      s.promedioEntradasDia, s.promedioSalidasDia, s.picoMaxSalidas,
      s.demandaPromedio, s.inventarioRecomendado, s.respaldoEmergencia,
      s.inventarioIdeal, s.deficit, s.estado,
    ])

    const totalActual = statsConActividad.reduce((s, d) => s + d.inventarioActual, 0)
    const totalIdeal = statsConActividad.reduce((s, d) => s + d.inventarioIdeal, 0)
    const totalDeficit = totalActual - totalIdeal
    const enDeficit = statsConActividad.filter(s => s.deficit < 0)
    const enOptimo = statsConActividad.filter(s => s.deficit >= s.respaldoEmergencia)

    const ws1Data = buildSheetData('Análisis de Demanda por Proceso', h1, d1, [
      { label: 'Período analizado', value: dateRange },
      { label: 'Procesos analizados', value: statsConActividad.length },
      { label: 'Total inventario actual', value: totalActual },
      { label: 'Total inventario ideal', value: totalIdeal },
      { label: 'Diferencia global', value: totalDeficit },
      { label: 'Procesos en déficit', value: enDeficit.length },
      { label: 'Procesos en estado óptimo', value: enOptimo.length },
    ])
    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data)
    ws1['!cols'] = [5, 25, 10, 14, 12, 16, 16, 16, 14, 16, 22, 14, 12, 22].map(w => ({ wch: w }))
    applyMerges(ws1, h1.length, d1.length)
    XLSX.utils.book_append_sheet(wb, ws1, 'Demanda por Proceso')

    // === HOJA 2: DIAGNÓSTICO DETALLADO ===
    const h2 = ['Proceso', 'Situación Actual', 'Tiene', 'Necesita', 'Faltan / Sobran', 'Recomendación']
    const d2 = statsConActividad
      .filter(s => s.inventarioActual > 0 || s.inventarioIdeal > 0)
      .sort((a, b) => a.deficit - b.deficit) // Los más críticos primero
      .map(s => {
        let situacion = ''
        let recomendacion = ''

        if (s.deficit < -s.respaldoEmergencia) {
          situacion = 'DÉFICIT CRÍTICO - El flujo se puede detener'
          recomendacion = `Asignar URGENTE al menos ${Math.abs(s.deficit)} canastillas adicionales. El proceso no tiene respaldo ante picos de demanda (pico: ${s.picoMaxSalidas}/día vs actual: ${s.inventarioActual}).`
        } else if (s.deficit < 0) {
          situacion = 'DÉFICIT LEVE - Opera justo sin margen'
          recomendacion = `Agregar ${Math.abs(s.deficit)} canastillas para tener respaldo. Actualmente opera al límite: cualquier pico o novedad detendrá el flujo.`
        } else if (s.deficit < s.respaldoEmergencia) {
          situacion = 'JUSTO - Cubre demanda pero sin emergencias'
          recomendacion = `El proceso cubre la demanda diaria promedio (${s.demandaPromedio}/día) pero no tiene margen suficiente para picos de ${s.picoMaxSalidas}/día. Considerar ${s.respaldoEmergencia - s.deficit} unidades extra.`
        } else {
          situacion = 'ÓPTIMO - Con respaldo de emergencia'
          recomendacion = `El proceso tiene inventario suficiente (${s.inventarioActual}) para cubrir demanda (${s.demandaPromedio}/día) y picos (${s.picoMaxSalidas}/día) con ${s.deficit} unidades de respaldo.`
        }

        return [
          s.departamento,
          situacion,
          s.inventarioActual,
          s.inventarioIdeal,
          s.deficit,
          recomendacion,
        ]
      })

    const ws2Data = buildSheetData('Diagnóstico y Recomendaciones', h2, d2)
    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data)
    ws2['!cols'] = [25, 35, 10, 10, 14, 60].map(w => ({ wch: w }))
    applyMerges(ws2, h2.length, d2.length)
    XLSX.utils.book_append_sheet(wb, ws2, 'Diagnóstico')

    // === HOJA 3: FLUJO DIARIO DETALLADO ===
    const h3 = ['Fecha', 'Proceso', 'Entradas', 'Salidas', 'Flujo Neto', 'Observación']
    const d3: any[][] = []
    const diasSet = new Set<string>()
    Object.values(flujoDiario).forEach(dias => Object.keys(dias).forEach(d => diasSet.add(d)))
    const diasOrdenados = Array.from(diasSet).sort()

    for (const dia of diasOrdenados) {
      for (const dept of departamentos) {
        const flujo = flujoDiario[dept]?.[dia]
        if (!flujo) continue
        const neto = flujo.entradas - flujo.salidas
        let obs = ''
        const stat = statsConActividad.find(s => s.departamento === dept)
        if (stat && flujo.salidas > stat.inventarioRecomendado) {
          obs = '⚠️ Salidas superaron el inventario recomendado'
        } else if (flujo.salidas > flujo.entradas * 1.5) {
          obs = '⚠️ Salidas muy por encima de entradas'
        }
        d3.push([formatDateDisplay(dia), dept, flujo.entradas, flujo.salidas, neto, obs])
      }
    }

    const ws3Data = buildSheetData('Flujo Diario por Proceso', h3, d3, [
      { label: 'Período', value: dateRange },
      { label: 'Días con movimientos', value: diasOrdenados.length },
      { label: 'Total movimientos registrados', value: d3.length },
    ])
    const ws3 = XLSX.utils.aoa_to_sheet(ws3Data)
    ws3['!cols'] = [14, 25, 12, 12, 12, 40].map(w => ({ wch: w }))
    applyMerges(ws3, h3.length, d3.length)
    XLSX.utils.book_append_sheet(wb, ws3, 'Flujo Diario')

    exportExcel(wb, 'Demanda_Por_Proceso')
  }

  // Helper para aplicar merges estándar del encabezado corporativo
  function applyMerges(ws: XLSX.WorkSheet, colCount: number, dataLength: number) {
    ws['!rows'] = [{ hpt: 35 }, { hpt: 20 }, { hpt: 10 }, { hpt: 28 }, { hpt: 18 }, { hpt: 10 }, { hpt: 28 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: colCount - 1 } },
    ]
    const smTitleIdx = dataLength + 8
    ws['!merges'].push({ s: { r: smTitleIdx, c: 0 }, e: { r: smTitleIdx, c: colCount - 1 } })
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
                  : category.color === 'amber'
                  ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20'
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    category.color === 'emerald'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-300'
                      : category.color === 'amber'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-300'
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
                            : category.color === 'amber'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 shadow-md ring-1 ring-amber-200'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md ring-1 ring-blue-200'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      {isSelected && (
                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                          category.color === 'emerald' ? 'bg-emerald-500' : category.color === 'amber' ? 'bg-amber-500' : 'bg-blue-500'
                        }`}>
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <div className={`mb-2 ${
                        isSelected
                          ? category.color === 'emerald' ? 'text-emerald-600' : category.color === 'amber' ? 'text-amber-600' : 'text-blue-600'
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
                        {(report.id === 'trazabilidad' || report.id === 'inventario' || report.id === 'alquileres' || report.id === 'traspasos' || report.id === 'ingresos') && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200">
                            {report.id === 'inventario' ? '5 hojas' : report.id === 'trazabilidad' ? '3 hojas' : '4 hojas'}
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
