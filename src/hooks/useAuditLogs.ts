/**
 * @module useAuditLogs
 * @description Hook para obtener y filtrar logs de auditoría del sistema.
 * Proporciona paginación, filtros por módulo, acción, usuario y rango de fechas,
 * y funciones para limpiar filtros y refrescar datos.
 */
import { useState, useEffect, useCallback } from 'react'
import { getAuditLogs } from '@/services/auditService'
import type { AuditLog } from '@/types'

interface AuditFilters {
  module: string
  action: string
  userId: string
  dateFrom: string
  dateTo: string
  search: string
}

/**
 * Hook que gestiona la obtención y filtrado de logs de auditoría.
 * @returns Objeto con logs, estado de carga, paginación, filtros y funciones de control.
 * @returns {AuditLog[]} logs - Lista de registros de auditoría de la página actual.
 * @returns {boolean} loading - Indica si se están cargando los datos.
 * @returns {number} totalCount - Total de registros que coinciden con los filtros.
 * @returns {number} page - Página actual (base 0).
 * @returns {number} totalPages - Total de páginas disponibles.
 * @returns {AuditFilters} filters - Filtros activos.
 * @returns {Function} setPage - Cambia la página actual.
 * @returns {Function} updateFilter - Actualiza un filtro específico.
 * @returns {Function} clearFilters - Limpia todos los filtros.
 * @returns {Function} refetch - Recarga los datos.
 */
export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<AuditFilters>({
    module: '',
    action: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  })

  const PAGE_SIZE = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const { data, count } = await getAuditLogs({
        module: filters.module || undefined,
        action: filters.action || undefined,
        userId: filters.userId || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        search: filters.search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      setLogs(data)
      setTotalCount(count)
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const updateFilter = (key: keyof AuditFilters, value: string) => {
    setPage(0)
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setPage(0)
    setFilters({ module: '', action: '', userId: '', dateFrom: '', dateTo: '', search: '' })
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return {
    logs,
    loading,
    totalCount,
    page,
    totalPages,
    filters,
    setPage,
    updateFilter,
    clearFilters,
    refetch: fetchLogs,
  }
}
