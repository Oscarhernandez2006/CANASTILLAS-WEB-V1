/**
 * @module TrazabilidadPage
 * @description Trazabilidad completa del historial de cada canastilla.
 */
import { useState, useMemo } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useTrazabilidad } from '@/hooks/useTrazabilidad'
import type { LoteGroup, Movimiento } from '@/hooks/useTrazabilidad'

// ============================================================
// HELPERS
// ============================================================

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_COLORS: Record<string, string> = {
  DISPONIBLE: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  EN_USO_INTERNO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  EN_ALQUILER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  EN_LAVADO: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  EN_REPARACION: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  FUERA_SERVICIO: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  EXTRAVIADA: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  DADA_DE_BAJA: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

const MOVIMIENTO_CONFIG: Record<string, { label: string; icon: JSX.Element; color: string; bgColor: string; lineColor: string }> = {
  CREACION: {
    label: 'Creación de Lote',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700',
    lineColor: 'bg-emerald-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
  },
  TRASPASO: {
    label: 'Traspaso',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700',
    lineColor: 'bg-blue-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  ALQUILER: {
    label: 'Alquiler',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-700',
    lineColor: 'bg-purple-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  LAVADO: {
    label: 'Lavado',
    color: 'text-cyan-700 dark:text-cyan-300',
    bgColor: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-900/30 dark:border-cyan-700',
    lineColor: 'bg-cyan-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  DEVOLUCION_TRASPASO: {
    label: 'Devolución de Traspaso',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700',
    lineColor: 'bg-amber-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
  },
  DEVOLUCION_ALQUILER: {
    label: 'Devolución de Alquiler',
    color: 'text-pink-700 dark:text-pink-300',
    bgColor: 'bg-pink-50 border-pink-200 dark:bg-pink-900/30 dark:border-pink-700',
    lineColor: 'bg-pink-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H5m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
      </svg>
    ),
  },
}

const ESTADO_BADGE: Record<string, string> = {
  COMPLETADO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  PENDIENTE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  ACEPTADO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  RECHAZADO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  CANCELADO: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ACTIVO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  PENDIENTE_FIRMA: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  RETORNADO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  VENCIDO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  PERDIDO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  ENVIADO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  RECIBIDO: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  LAVADO_COMPLETADO: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  ENTREGADO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  CONFIRMADO: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

const SIZE_LABELS: Record<string, string> = { GRANDE: 'Grande', MEDIANA: 'Mediana' }
const PROPIEDAD_LABELS: Record<string, string> = { PROPIA: 'Propia', ALQUILADA: 'Alquilada' }

// ============================================================
// PAGE
// ============================================================

export function TrazabilidadPage() {
  const {
    lotes,
    loading,
    selectedLote,
    movimientos,
    loadingMovimientos,
    fetchMovimientos,
    setSelectedLote,
  } = useTrazabilidad()

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSize, setFilterSize] = useState<string>('TODOS')
  const [filterColor, setFilterColor] = useState<string>('TODOS')

  // Colores únicos para filtro
  const uniqueColors = useMemo(() => {
    const colors = [...new Set(lotes.map(l => l.color))].filter(Boolean).sort()
    return colors
  }, [lotes])

  // Lotes filtrados
  const filteredLotes = useMemo(() => {
    return lotes.filter(lote => {
      const matchSearch = searchTerm === '' ||
        lote.codigos.some(c => c.toLowerCase().includes(searchTerm.toLowerCase())) ||
        lote.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lote.size.toLowerCase().includes(searchTerm.toLowerCase())
      const matchSize = filterSize === 'TODOS' || lote.size === filterSize
      const matchColor = filterColor === 'TODOS' || lote.color === filterColor
      return matchSearch && matchSize && matchColor
    })
  }, [lotes, searchTerm, filterSize, filterColor])

  // Estadísticas globales
  const stats = useMemo(() => {
    const totalCanastillas = lotes.reduce((acc, l) => acc + l.totalCanastillas, 0)
    const totalLotes = lotes.length
    const statusTotals: Record<string, number> = {}
    for (const l of lotes) {
      for (const [status, count] of Object.entries(l.statuses)) {
        statusTotals[status] = (statusTotals[status] || 0) + count
      }
    }
    return { totalCanastillas, totalLotes, statusTotals }
  }, [lotes])

  const handleSelectLote = (lote: LoteGroup) => {
    if (selectedLote?.id === lote.id) {
      setSelectedLote(null)
    } else {
      fetchMovimientos(lote)
    }
  }

  // ============================================================
  // RENDER: Stats Cards
  // ============================================================
  const renderStats = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalLotes}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Lotes</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCanastillas.toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Canastillas</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{(stats.statusTotals['DISPONIBLE'] || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Disponibles</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{((stats.statusTotals['EN_USO_INTERNO'] || 0) + (stats.statusTotals['EN_ALQUILER'] || 0) + (stats.statusTotals['EN_LAVADO'] || 0) + (stats.statusTotals['EN_RETORNO'] || 0)).toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">En movimiento</p>
          </div>
        </div>
      </div>
    </div>
  )

  // ============================================================
  // RENDER: Search & Filters
  // ============================================================
  const renderFilters = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por código, color o tamaño..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Filtro tamaño */}
        <select
          value={filterSize}
          onChange={(e) => setFilterSize(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
        >
          <option value="TODOS">Todos los tamaños</option>
          <option value="GRANDE">Grande</option>
          <option value="MEDIANA">Mediana</option>
        </select>

        {/* Filtro color */}
        <select
          value={filterColor}
          onChange={(e) => setFilterColor(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
        >
          <option value="TODOS">Todos los colores</option>
          {uniqueColors.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Mostrando <span className="font-semibold text-gray-700 dark:text-gray-200">{filteredLotes.length}</span> de {lotes.length} lotes
        </p>
        {(searchTerm || filterSize !== 'TODOS' || filterColor !== 'TODOS') && (
          <button
            onClick={() => { setSearchTerm(''); setFilterSize('TODOS'); setFilterColor('TODOS') }}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )

  // ============================================================
  // RENDER: Lote Card
  // ============================================================
  const renderLoteCard = (lote: LoteGroup) => {
    const isSelected = selectedLote?.id === lote.id
    const statusEntries = Object.entries(lote.statuses).sort((a, b) => b[1] - a[1])
    const mainStatus = statusEntries[0]

    return (
      <div
        key={lote.id}
        onClick={() => handleSelectLote(lote)}
        className={`group cursor-pointer rounded-xl border-2 transition-all duration-200 p-4 ${
          isSelected
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg shadow-primary-100 dark:shadow-primary-900/30 ring-1 ring-primary-300'
            : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-md'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isSelected ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {lote.totalCanastillas} <span className="font-normal text-gray-500 dark:text-gray-400">canastillas</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(lote.createdAt)}</p>
            </div>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            lote.tipo_propiedad === 'PROPIA'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
          }`}>
            {PROPIEDAD_LABELS[lote.tipo_propiedad] || lote.tipo_propiedad}
          </span>
        </div>

        {/* Atributos */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {SIZE_LABELS[lote.size] || lote.size}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            <span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: lote.color.toLowerCase() }}></span>
            {lote.color}
          </span>
          {lote.shape && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {lote.shape}
            </span>
          )}
        </div>

        {/* Status breakdown - mini bar */}
        <div className="mb-2">
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
            {statusEntries.map(([status, count]) => {
              const percent = (count / lote.totalCanastillas) * 100
              const barColors: Record<string, string> = {
                DISPONIBLE: 'bg-green-500',
                EN_USO_INTERNO: 'bg-blue-500',
                EN_ALQUILER: 'bg-purple-500',
                EN_LAVADO: 'bg-cyan-500',
                EN_REPARACION: 'bg-yellow-500',
                FUERA_SERVICIO: 'bg-red-500',
                EXTRAVIADA: 'bg-red-400',
                DADA_DE_BAJA: 'bg-gray-400',
              }
              return (
                <div
                  key={status}
                  className={`${barColors[status] || 'bg-gray-400'} transition-all`}
                  style={{ width: `${percent}%` }}
                  title={`${status}: ${count}`}
                />
              )
            })}
          </div>
        </div>

        {/* Status labels */}
        <div className="flex flex-wrap gap-1">
          {statusEntries.slice(0, 3).map(([status, count]) => (
            <span key={status} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
              {status.replace(/_/g, ' ')}: {count}
            </span>
          ))}
          {statusEntries.length > 3 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 self-center">
              +{statusEntries.length - 3} más
            </span>
          )}
        </div>

        {/* Códigos de muestra */}
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">
            {lote.codigos.slice(0, 3).join(' · ')}
            {lote.codigos.length > 3 && ' ...'}
          </p>
        </div>

        {/* Indicator de selección */}
        {isSelected && (
          <div className="mt-2 flex items-center justify-center text-xs text-primary-600 dark:text-primary-400 font-medium">
            <svg className="w-4 h-4 mr-1 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Viendo trazabilidad
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // RENDER: Movement Details
  // ============================================================
  const renderMovimientoDetails = (mov: Movimiento) => {
    const d = mov.detalles

    switch (mov.tipo) {
      case 'CREACION':
        return (
          <div className="grid grid-cols-3 gap-2 text-xs mt-2">
            <div>
              <span className="text-gray-400">Tamaño</span>
              <p className="font-medium text-gray-700 dark:text-gray-300">{SIZE_LABELS[d.size as string] || (d.size as string)}</p>
            </div>
            <div>
              <span className="text-gray-400">Color</span>
              <p className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
                <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: (d.color as string).toLowerCase() }}></span>
                {d.color as string}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Tipo</span>
              <p className="font-medium text-gray-700 dark:text-gray-300">{PROPIEDAD_LABELS[d.tipo_propiedad as string] || (d.tipo_propiedad as string)}</p>
            </div>
          </div>
        )

      case 'TRASPASO':
        return (
          <div className="space-y-2 mt-2">
            <div className="flex items-center text-xs space-x-2">
              <div className="flex items-center space-x-1 flex-1 min-w-0">
                <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-gray-500 dark:text-gray-400 truncate">{d.fromUser as string}</span>
              </div>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <div className="flex items-center space-x-1 flex-1 min-w-0 justify-end">
                <span className="text-gray-700 dark:text-gray-200 font-medium truncate">
                  {d.isExternal ? (d.externalRecipient as string) : (d.toUser as string)}
                </span>
                {d.isExternal && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300">EXT</span>
                )}
              </div>
            </div>
            {d.externalEmpresa && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 pl-7">Empresa: {d.externalEmpresa as string}</p>
            )}
            <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
              {d.remisionNumber && <span>Remisión: {d.remisionNumber as string}</span>}
              {d.hasFirma && (
                <span className="flex items-center text-green-600 dark:text-green-400">
                  <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Firmado
                </span>
              )}
            </div>
            {d.notes && <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">"{d.notes as string}"</p>}
          </div>
        )

      case 'ALQUILER':
        return (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Punto de venta</span>
                <p className="font-medium text-gray-700 dark:text-gray-300">{d.salePoint as string}</p>
              </div>
              <div>
                <span className="text-gray-400">Tipo</span>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    d.rentalType === 'INTERNO' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
                  }`}>
                    {d.rentalType as string}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-gray-400 dark:text-gray-500">
              {d.dailyRate && <span>Tarifa: ${(d.dailyRate as number).toLocaleString()}/día</span>}
              {d.estimatedDays && <span>Est: {d.estimatedDays as number} días</span>}
              {d.actualDays && <span>Real: {d.actualDays as number} días</span>}
              {d.totalAmount && <span className="font-medium text-gray-600 dark:text-gray-300">Total: ${(d.totalAmount as number).toLocaleString()}</span>}
            </div>
            {d.invoiceNumber && <p className="text-[11px] text-gray-400">Factura: {d.invoiceNumber as string}</p>}
          </div>
        )

      case 'LAVADO':
        return (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Enviado por</span>
                <p className="font-medium text-gray-700 dark:text-gray-300">{d.senderUser as string}</p>
              </div>
              <div>
                <span className="text-gray-400">Personal de lavado</span>
                <p className="font-medium text-gray-700 dark:text-gray-300">{d.washingStaff as string}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              {(d.washedCount as number) > 0 && (
                <span className="text-green-600 dark:text-green-400">
                  ✓ {d.washedCount as number} lavadas
                </span>
              )}
              {(d.damagedCount as number) > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  ✕ {d.damagedCount as number} dañadas
                </span>
              )}
              {d.remisionEntrega && <span className="text-gray-400">Rem. Entrega: {d.remisionEntrega as string}</span>}
              {d.remisionDevolucion && <span className="text-gray-400">Rem. Devolución: {d.remisionDevolucion as string}</span>}
            </div>
            {d.notes && <p className="text-[11px] text-gray-400 italic">"{d.notes as string}"</p>}
          </div>
        )

      case 'DEVOLUCION_TRASPASO':
        return (
          <div className="space-y-1 mt-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">Procesado por:</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{d.processedBy as string}</span>
              {d.hasFirma && (
                <span className="flex items-center text-green-600 dark:text-green-400 text-[11px]">
                  <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Firmado
                </span>
              )}
            </div>
            {d.notes && <p className="text-[11px] text-gray-400 italic">"{d.notes as string}"</p>}
          </div>
        )

      case 'DEVOLUCION_ALQUILER':
        return (
          <div className="space-y-1 mt-2 text-xs">
            <div className="flex items-center gap-4">
              <span className="text-gray-400">Procesado por: <span className="font-medium text-gray-700 dark:text-gray-300">{d.processedBy as string}</span></span>
              {d.daysCharged && <span className="text-gray-400">{d.daysCharged as number} días cobrados</span>}
              {d.amount && <span className="font-medium text-gray-600 dark:text-gray-300">${(d.amount as number).toLocaleString()}</span>}
            </div>
            {d.invoiceNumber && <p className="text-[11px] text-gray-400">Factura: {d.invoiceNumber as string}</p>}
            {d.notes && <p className="text-[11px] text-gray-400 italic">"{d.notes as string}"</p>}
          </div>
        )

      default:
        return null
    }
  }

  // ============================================================
  // RENDER: Timeline
  // ============================================================
  const renderTimeline = () => {
    if (!selectedLote) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Selecciona un lote</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
            Haz clic en un lote de la lista para ver su trazabilidad completa con todos sus movimientos
          </p>
        </div>
      )
    }

    if (loadingMovimientos) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando trazabilidad...</p>
        </div>
      )
    }

    return (
      <div>
        {/* Lote Summary Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-5 mb-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold">Trazabilidad del Lote</h3>
            <button
              onClick={() => setSelectedLote(null)}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-white/60 text-xs">Canastillas</p>
              <p className="text-xl font-bold">{selectedLote.totalCanastillas}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Movimientos</p>
              <p className="text-xl font-bold">{movimientos.length}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Tamaño / Color</p>
              <p className="text-sm font-medium">{SIZE_LABELS[selectedLote.size] || selectedLote.size} · {selectedLote.color}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Creación</p>
              <p className="text-sm font-medium">{formatDate(selectedLote.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Resumen de tipos de movimiento */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(
            movimientos.reduce<Record<string, number>>((acc, m) => {
              acc[m.tipo] = (acc[m.tipo] || 0) + 1
              return acc
            }, {})
          ).map(([tipo, count]) => {
            const config = MOVIMIENTO_CONFIG[tipo]
            if (!config) return null
            return (
              <span key={tipo} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${config.bgColor} ${config.color}`}>
                {config.icon}
                {config.label}: {count}
              </span>
            )
          })}
        </div>

        {/* Timeline */}
        <div className="relative">
          {movimientos.map((mov, index) => {
            const config = MOVIMIENTO_CONFIG[mov.tipo]
            if (!config) return null
            const isLast = index === movimientos.length - 1

            return (
              <div key={mov.id} className="relative flex group">
                {/* Línea vertical + punto */}
                <div className="flex flex-col items-center mr-4 flex-shrink-0">
                  <div className={`w-10 h-10 rounded-xl ${config.lineColor} text-white flex items-center justify-center shadow-lg z-10 group-hover:scale-110 transition-transform`}>
                    {config.icon}
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gradient-to-b from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 min-h-[24px]"></div>
                  )}
                </div>

                {/* Contenido */}
                <div className={`flex-1 pb-6 ${isLast ? 'pb-0' : ''}`}>
                  <div className={`rounded-xl border p-4 transition-all group-hover:shadow-md ${config.bgColor}`}>
                    {/* Header del movimiento */}
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatDateTime(mov.fecha)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${ESTADO_BADGE[mov.estado] || 'bg-gray-100 text-gray-600'}`}>
                          {mov.estado.replace(/_/g, ' ')}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800">
                          {mov.cantidad} uds
                        </span>
                      </div>
                    </div>

                    {/* Detalles específicos del movimiento */}
                    {renderMovimientoDetails(mov)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  if (loading) {
    return (
      <DashboardLayout title="Trazabilidad" subtitle="Seguimiento de movimientos por lote">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Cargando lotes de canastillas...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Trazabilidad" subtitle="Seguimiento de movimientos por lote de canastillas">
      {/* Stats */}
      {renderStats()}

      {/* Filtros */}
      {renderFilters()}

      {/* Main content: split view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de lotes - Left Panel */}
        <div className={`${selectedLote ? 'lg:col-span-4' : 'lg:col-span-12'} transition-all duration-300`}>
          {filteredLotes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No se encontraron lotes</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Intenta con otros criterios de búsqueda</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${
              selectedLote
                ? 'grid-cols-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 custom-scrollbar'
                : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
            }`}>
              {filteredLotes.map(lote => renderLoteCard(lote))}
            </div>
          )}
        </div>

        {/* Timeline - Right Panel */}
        {selectedLote && (
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sticky top-4 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
              {renderTimeline()}
            </div>
          </div>
        )}

        {/* Timeline placeholder when no lote selected (shown on large screens only) */}
        {!selectedLote && (
          <div className="hidden lg:block lg:col-span-12">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              {renderTimeline()}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
