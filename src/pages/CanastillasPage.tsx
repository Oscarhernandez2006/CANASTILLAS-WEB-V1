/**
 * @module CanastillasPage
 * @description Gestión de canastillas agrupadas por lotes: crear, editar lote, dar salida, escaneo QR.
 */
import { useState, useEffect, useMemo, Fragment } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { CanastillaDetailModal } from '@/components/CanastillaDetailModal'
import { CrearLoteCanastillasModal } from '@/components/CrearLoteCanastillasModal'
import { SalidaCanastillasModal } from '@/components/SalidaCanastillasModal'
import { EditarLoteModal } from '@/components/EditarLoteModal'
import type { LoteGroup } from '@/components/EditarLoteModal'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'
import type { Canastilla } from '@/types'
import { getStatusLabel, getStatusColor } from '@/utils/helpers'

export function CanastillasPage() {
  const [canastillas, setCanastillas] = useState<Canastilla[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [showLoteModal, setShowLoteModal] = useState(false)
  const [showSalidaModal, setShowSalidaModal] = useState(false)
  const [showEditLoteModal, setShowEditLoteModal] = useState(false)
  const [selectedLote, setSelectedLote] = useState<LoteGroup | null>(null)
  const [expandedLotes, setExpandedLotes] = useState<Set<string>>(new Set())
  const [selectedCanastillaDetail, setSelectedCanastillaDetail] = useState<Canastilla | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const permissions = usePermissions()

  useEffect(() => {
    fetchCanastillas()
  }, [])

  const fetchCanastillas = async () => {
    try {
      setLoading(true)

      // Cargar TODAS las canastillas usando paginación interna
      // Supabase limita a 1000 filas por consulta
      const PAGE_SIZE = 1000
      let allCanastillas: Canastilla[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error } = await supabase
          .from('canastillas')
          .select('id, codigo, qr_code, size, color, status, condition, current_location, shape, tipo_propiedad, current_owner_id, created_at')
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)

        if (error) throw error

        if (data && data.length > 0) {
          allCanastillas = [...allCanastillas, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      setCanastillas(allCanastillas)
    } catch (error) {
      console.error('Error fetching canastillas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = (canastilla: Canastilla) => {
    setSelectedCanastillaDetail(canastilla)
    setShowDetailModal(true)
  }

  const handleEditLote = (lote: LoteGroup) => {
    setSelectedLote(lote)
    setShowEditLoteModal(true)
  }

  const toggleExpandLote = (key: string) => {
    setExpandedLotes(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSuccess = () => {
    fetchCanastillas()
  }

  // Filtrar canastillas
  const filteredCanastillas = canastillas.filter(canastilla => {
    const matchesSearch =
      canastilla.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      canastilla.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (canastilla.current_location && canastilla.current_location.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (canastilla.size && canastilla.size.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (canastilla.shape && canastilla.shape.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = filterStatus === 'ALL' || canastilla.status === filterStatus

    return matchesSearch && matchesStatus
  })

  // Agrupar por lote: size+color+shape+condition+status+tipo_propiedad+location
  const lotes = useMemo(() => {
    const groups = new Map<string, LoteGroup>()

    filteredCanastillas.forEach(c => {
      const key = `${c.size}|${c.color}|${c.shape || ''}|${c.condition}|${c.status}|${c.tipo_propiedad || 'PROPIA'}|${c.current_location || ''}`
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          size: c.size,
          color: c.color,
          shape: c.shape || '',
          condition: c.condition,
          status: c.status,
          tipo_propiedad: c.tipo_propiedad || 'PROPIA',
          current_location: c.current_location || '',
          cantidad: 0,
          ids: [],
        })
      }
      const group = groups.get(key)!
      group.cantidad++
      group.ids.push(c.id)
    })

    // Ordenar por cantidad desc
    return Array.from(groups.values()).sort((a, b) => b.cantidad - a.cantidad)
  }, [filteredCanastillas])

  // Canastillas de un lote expandido
  const getCanastillasOfLote = (lote: LoteGroup) => {
    return filteredCanastillas.filter(c => lote.ids.includes(c.id))
  }

  // Paginación sobre lotes
  // Paginación sobre lotes
  const totalPages = Math.ceil(lotes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedLotes = lotes.slice(startIndex, startIndex + itemsPerPage)

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus])

  if (loading) {
    return (
      <DashboardLayout title="Canastillas" subtitle="Gestión de inventario">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Canastillas" subtitle={`${canastillas.length} canastillas en inventario`}>
      <div className="space-y-6">
        {/* Header con búsqueda y filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            {/* Búsqueda */}
            <div className="w-full">
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar código, color, ubicación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                />
              </div>
            </div>

            {/* Filtro y botones */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Filtro por estado */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
              >
                <option value="ALL">Todos los estados</option>
                <option value="DISPONIBLE">Disponible</option>
                <option value="EN_ALQUILER">En Alquiler</option>
                <option value="EN_RETORNO">En Retorno</option>
                <option value="EN_LAVADO">En Lavado</option>
                <option value="EN_USO_INTERNO">En Uso Interno</option>
                <option value="EN_REPARACION">En Reparación</option>
                <option value="FUERA_SERVICIO">Fuera de Servicio</option>
                <option value="EXTRAVIADA">Extraviada</option>
              </select>

              <div className="flex gap-2 sm:gap-3">
                {permissions.hasCanastillaPermission('create') && (
                  <Button variant="outline" onClick={() => setShowLoteModal(true)} className="flex-1 sm:flex-none text-sm">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="hidden sm:inline">Crear Lote</span>
                    <span className="sm:hidden">Lote</span>
                  </Button>
                )}

                {permissions.hasCanastillaPermission('delete') && (
                  <Button
                    variant="outline"
                    onClick={() => setShowSalidaModal(true)}
                    className="flex-1 sm:flex-none border-red-300 text-red-600 hover:bg-red-50 text-sm"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="hidden sm:inline">Salida</span>
                    <span className="sm:hidden">Salida</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Disponibles</p>
                <p className="text-2xl font-bold mt-1">{canastillas.filter(c => c.status === 'DISPONIBLE').length}</p>
              </div>
              <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">En Alquiler</p>
                <p className="text-2xl font-bold mt-1">{canastillas.filter(c => c.status === 'EN_ALQUILER').length}</p>
              </div>
              <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 dark:from-cyan-600 dark:to-cyan-700 p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">En Lavado</p>
                <p className="text-2xl font-bold mt-1">{canastillas.filter(c => c.status === 'EN_LAVADO').length}</p>
              </div>
              <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Uso Interno</p>
                <p className="text-2xl font-bold mt-1">{canastillas.filter(c => c.status === 'EN_USO_INTERNO').length}</p>
              </div>
              <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de Lotes */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Lotes de Canastillas</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {lotes.length} lotes ({filteredCanastillas.length} canastillas)
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider w-10"></th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Tamaño
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Color
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Forma
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Condición
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginatedLotes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">No se encontraron canastillas</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Intenta ajustar los filtros o crear un nuevo lote</p>
                    </td>
                  </tr>
                ) : (
                  paginatedLotes.map((lote) => {
                    const isExpanded = expandedLotes.has(lote.key)
                    return (
                      <Fragment key={lote.key}>
                        {/* Fila del lote */}
                        <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => toggleExpandLote(lote.key)}>
                          <td className="px-4 py-3.5">
                            <button className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                              <svg className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(lote.status)}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                              {getStatusLabel(lote.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg">
                              {lote.size}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-500 flex-shrink-0" style={{ backgroundColor: lote.color.toLowerCase() }}></div>
                              <span className="text-sm text-gray-900 dark:text-white">{lote.color}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {lote.shape || '—'}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {lote.condition}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {lote.current_location || 'Sin ubicación'}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <span className="inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1 text-sm font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                              {lote.cantidad}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {permissions.hasCanastillaPermission('edit') && (
                                <button
                                  onClick={() => handleEditLote(lote)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                  title="Editar lote"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Editar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Filas expandidas: canastillas individuales del lote */}
                        {isExpanded && getCanastillasOfLote(lote).map((canastilla) => (
                          <tr key={canastilla.id} className="bg-gray-50/80 dark:bg-gray-750 dark:bg-gray-900/30">
                            <td className="pl-6 pr-2 py-2.5">
                              <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-auto"></div>
                            </td>
                            <td colSpan={6} className="px-4 py-2.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <svg className="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{canastilla.codigo}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{canastilla.qr_code}</p>
                                </div>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {canastilla.tipo_propiedad || 'PROPIA'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={() => handleViewDetail(canastilla)}
                                className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                title="Ver detalles y QR"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginación */}
        {lotes.length > 0 && (
          <div className="flex flex-col items-center gap-3 sm:gap-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 px-4 sm:px-6 py-4">
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 text-center">
              <span className="font-medium">{startIndex + 1}</span>-
              <span className="font-medium">{Math.min(startIndex + itemsPerPage, lotes.length)}</span> de{' '}
              <span className="font-medium">{lotes.length}</span> lotes
              <span className="text-gray-500 dark:text-gray-400 hidden sm:inline"> ({filteredCanastillas.length} canastillas)</span>
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="hidden sm:inline">← Anterior</span>
                  <span className="sm:hidden">←</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page =>
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1
                    )
                    .map((page, idx, arr) => {
                      const showDots = idx > 0 && arr[idx - 1] !== page - 1
                      return (
                        <span key={page}>
                          {showDots && <span className="px-1 text-gray-400 text-xs">...</span>}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-lg transition-colors ${
                              currentPage === page
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {page}
                          </button>
                        </span>
                      )
                    })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="hidden sm:inline">Siguiente →</span>
                  <span className="sm:hidden">→</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Crear Lote */}
      <CrearLoteCanastillasModal
        isOpen={showLoteModal}
        onClose={() => setShowLoteModal(false)}
        onSuccess={handleSuccess}
      />

      {/* Modal de Detalles */}
      <CanastillaDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedCanastillaDetail(null)
        }}
        canastilla={selectedCanastillaDetail}
      />

      {/* Modal de Editar Lote */}
      <EditarLoteModal
        isOpen={showEditLoteModal}
        onClose={() => {
          setShowEditLoteModal(false)
          setSelectedLote(null)
        }}
        onSuccess={handleSuccess}
        lote={selectedLote}
      />

      {/* Modal de Salida de Canastillas */}
      <SalidaCanastillasModal
        isOpen={showSalidaModal}
        onClose={() => setShowSalidaModal(false)}
        onSuccess={fetchCanastillas}
      />
    </DashboardLayout>
  )
}