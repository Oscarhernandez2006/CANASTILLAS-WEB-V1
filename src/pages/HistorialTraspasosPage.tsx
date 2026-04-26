/**
 * @module HistorialTraspasosPage
 * @description Módulo de administración para visualizar el historial completo de traspasos
 * en tiempo real. Muestra traspasos pendientes, aceptados y rechazados con filtros
 * por usuario, ubicación y número de remisión.
 */
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useHistorialTraspasos } from '@/hooks/useHistorialTraspasos'
import type { HistorialTransfer } from '@/hooks/useHistorialTraspasos'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PENDIENTE: { label: 'Pendiente', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-400' },
  ACEPTADO: { label: 'Aceptado', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-400' },
  RECHAZADO: { label: 'Rechazado', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-400' },
  CANCELADO: { label: 'Cancelado', bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
  EXPIRADA: { label: 'Expirada', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-400' },
  ACEPTADO_AUTO: { label: 'Aceptado Automático', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-400' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getUserName(user?: { first_name: string; last_name: string; email: string }): string {
  if (!user) return 'Desconocido'
  return `${user.first_name} ${user.last_name}`.trim() || user.email
}

function TransferDetailCard({ transfer }: { transfer: HistorialTransfer }) {
  const [expanded, setExpanded] = useState(false)
  const status = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.CANCELADO

  const isExternal = transfer.is_external_transfer
  const isWashing = transfer.is_washing_transfer

  return (
    <div className={`rounded-xl border transition-all duration-200 ${
      transfer.status === 'PENDIENTE'
        ? 'border-yellow-200 dark:border-yellow-800 shadow-sm shadow-yellow-100 dark:shadow-yellow-900/10'
        : transfer.status === 'ACEPTADO'
        ? 'border-green-200 dark:border-green-800'
        : transfer.status === 'RECHAZADO'
        ? 'border-red-200 dark:border-red-800'
        : transfer.status === 'EXPIRADA'
        ? 'border-orange-200 dark:border-orange-800'
        : transfer.status === 'ACEPTADO_AUTO'
        ? 'border-blue-200 dark:border-blue-800'
        : 'border-gray-200 dark:border-gray-700'
    } bg-white dark:bg-gray-900 hover:shadow-md`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: Status + Remision */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${status.bg} ${status.text}`}>
              <span className={`w-2 h-2 rounded-full ${status.dot} ${transfer.status === 'PENDIENTE' ? 'animate-pulse' : ''}`} />
              {status.label}
            </div>
            {transfer.remision_number && (
              <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                #{transfer.remision_number}
              </span>
            )}
            {isExternal && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                Externo
              </span>
            )}
            {isWashing && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 font-medium">
                Lavado
              </span>
            )}
          </div>

          {/* Right: Item count + expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              {transfer.items_count ?? 0}
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Transfer Flow: From → To */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {/* From */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                {(transfer.from_user?.first_name || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {getUserName(transfer.from_user)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Envía</p>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center px-2">
            <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>

          {/* To */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {isExternal
                  ? (transfer.external_recipient_name || '?').charAt(0).toUpperCase()
                  : (transfer.to_user?.first_name || '?').charAt(0).toUpperCase()
                }
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {isExternal
                  ? transfer.external_recipient_name || 'Cliente Externo'
                  : getUserName(transfer.to_user)
                }
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Recibe</p>
            </div>
          </div>
        </div>

        {/* Date */}
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          {formatDate(transfer.requested_at)}
          {transfer.responded_at && ` — Respondido: ${formatDate(transfer.responded_at)}`}
        </p>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400 block text-xs font-medium uppercase tracking-wide mb-0.5">Origen</span>
              <p className="text-gray-900 dark:text-white font-medium">{getUserName(transfer.from_user)}</p>
              <p className="text-xs text-gray-500">{transfer.from_user?.email}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 block text-xs font-medium uppercase tracking-wide mb-0.5">Destino</span>
              {isExternal ? (
                <>
                  <p className="text-gray-900 dark:text-white font-medium">{transfer.external_recipient_name}</p>
                  {transfer.external_recipient_empresa && (
                    <p className="text-xs text-gray-500">{transfer.external_recipient_empresa}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-gray-900 dark:text-white font-medium">{getUserName(transfer.to_user)}</p>
                  <p className="text-xs text-gray-500">{transfer.to_user?.email}</p>
                </>
              )}
            </div>
            {transfer.sale_point && (
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-xs font-medium uppercase tracking-wide mb-0.5">Punto de Venta</span>
                <p className="text-gray-900 dark:text-white font-medium">{transfer.sale_point.name}</p>
                <p className="text-xs text-gray-500">{transfer.sale_point.city} — {transfer.sale_point.address}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500 dark:text-gray-400 block text-xs font-medium uppercase tracking-wide mb-0.5">Canastillas</span>
              <p className="text-gray-900 dark:text-white font-medium text-lg">{transfer.items_count ?? 0}</p>
            </div>
            {transfer.rejection_reason && (transfer.status === 'RECHAZADO' || transfer.status === 'CANCELADO' || transfer.status === 'EXPIRADA') && (
              <div className="sm:col-span-2">
                <span className="text-gray-500 dark:text-gray-400 block text-xs font-medium uppercase tracking-wide mb-0.5">
                  {transfer.status === 'RECHAZADO' ? 'Motivo del rechazo' : transfer.status === 'EXPIRADA' ? 'Motivo de expiración' : 'Motivo de cancelación'}
                </span>
                <div className={`mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  transfer.status === 'RECHAZADO'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : transfer.status === 'EXPIRADA'
                    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                  <span>⚠️</span>
                  {transfer.rejection_reason}
                </div>
              </div>
            )}
            {isExternal && (transfer.returned_items_count != null || transfer.pending_items_count != null) && (
              <div className="sm:col-span-2">
                <span className="text-gray-500 dark:text-gray-400 block text-xs font-medium uppercase tracking-wide mb-1">Devoluciones</span>
                <div className="flex items-center gap-3">
                  <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                    Devueltas: {transfer.returned_items_count || 0}
                  </span>
                  <span className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">
                    Pendientes: {transfer.pending_items_count || 0}
                  </span>
                </div>
                {(transfer.items_count ?? 0) > 0 && (
                  <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, ((transfer.returned_items_count || 0) / (transfer.items_count || 1)) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function HistorialTraspasosPage() {
  const {
    transfers,
    loading,
    filters,
    updateFilter,
    clearFilters,
    page,
    setPage,
    totalPages,
    totalCount,
    statusCounts,
  } = useHistorialTraspasos()

  const [showFilters, setShowFilters] = useState(true)

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
    <DashboardLayout title="Historial de Traspasos" subtitle="Control y seguimiento de todos los traspasos del sistema">
      <div className="space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <button
            onClick={() => updateFilter('status', filters.status === 'PENDIENTE' ? '' : 'PENDIENTE')}
            className={`rounded-xl p-4 text-left transition-all duration-200 border-2 ${
              filters.status === 'PENDIENTE'
                ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 ring-2 ring-yellow-200 dark:ring-yellow-800'
                : 'border-transparent bg-white dark:bg-gray-900 hover:border-yellow-200 dark:hover:border-yellow-800'
            } shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300 uppercase tracking-wide">Pendientes</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statusCounts.PENDIENTE}</p>
          </button>
          <button
            onClick={() => updateFilter('status', filters.status === 'ACEPTADO' ? '' : 'ACEPTADO')}
            className={`rounded-xl p-4 text-left transition-all duration-200 border-2 ${
              filters.status === 'ACEPTADO'
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-200 dark:ring-green-800'
                : 'border-transparent bg-white dark:bg-gray-900 hover:border-green-200 dark:hover:border-green-800'
            } shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">Aceptados</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statusCounts.ACEPTADO}</p>
          </button>
          <button
            onClick={() => updateFilter('status', filters.status === 'RECHAZADO' ? '' : 'RECHAZADO')}
            className={`rounded-xl p-4 text-left transition-all duration-200 border-2 ${
              filters.status === 'RECHAZADO'
                ? 'border-red-400 bg-red-50 dark:bg-red-900/20 ring-2 ring-red-200 dark:ring-red-800'
                : 'border-transparent bg-white dark:bg-gray-900 hover:border-red-200 dark:hover:border-red-800'
            } shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-xs font-medium text-red-700 dark:text-red-300 uppercase tracking-wide">Rechazados</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statusCounts.RECHAZADO}</p>
          </button>
          <button
            onClick={() => updateFilter('status', filters.status === 'EXPIRADA' ? '' : 'EXPIRADA')}
            className={`rounded-xl p-4 text-left transition-all duration-200 border-2 ${
              filters.status === 'EXPIRADA'
                ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-200 dark:ring-orange-800'
                : 'border-transparent bg-white dark:bg-gray-900 hover:border-orange-200 dark:hover:border-orange-800'
            } shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-orange-400" />
              <span className="text-xs font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide">Expiradas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statusCounts.EXPIRADA}</p>
          </button>
          <button
            onClick={() => updateFilter('status', filters.status === 'ACEPTADO_AUTO' ? '' : 'ACEPTADO_AUTO')}
            className={`rounded-xl p-4 text-left transition-all duration-200 border-2 ${
              filters.status === 'ACEPTADO_AUTO'
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
                : 'border-transparent bg-white dark:bg-gray-900 hover:border-blue-200 dark:hover:border-blue-800'
            } shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">Auto-Aceptados</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statusCounts.ACEPTADO_AUTO}</p>
          </button>
          <div className="rounded-xl p-4 text-left bg-white dark:bg-gray-900 shadow-sm border-2 border-transparent">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-primary-400" />
              <span className="text-xs font-medium text-primary-700 dark:text-primary-300 uppercase tracking-wide">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{statusCounts.total}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros de búsqueda</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-primary-500" />
              )}
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFilters && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Buscar por usuario, remisión, ubicación o empresa
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Nombre, email, # remisión, punto de venta, ciudad..."
                      value={filters.search}
                      onChange={e => updateFilter('search', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* From Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Desde</label>
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={e => updateFilter('fromDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* To Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={e => updateFilter('toDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Status tabs + clear */}
              <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-1.5 flex-wrap">
                  {['', 'PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'CANCELADO'].map(s => (
                    <button
                      key={s}
                      onClick={() => updateFilter('status', s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        filters.status === s
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {s === '' ? 'Todos' : STATUS_CONFIG[s]?.label || s}
                    </button>
                  ))}
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Cargando traspasos...</p>
            </div>
          </div>
        ) : transfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No se encontraron traspasos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {hasActiveFilters ? 'Intenta ajustar los filtros de búsqueda' : 'Aún no hay traspasos registrados en el sistema'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transfers.map((transfer: HistorialTransfer) => (
              <TransferDetailCard key={transfer.id} transfer={transfer} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Página {page} de {totalPages} ({totalCount} traspasos)
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
