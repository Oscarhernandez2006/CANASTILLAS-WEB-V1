/**
 * @module DashboardPage
 * @description Dashboard principal con tarjetas de estadísticas, filtros por tipo de usuario y mapa de canastillas.
 */
import { useState, useMemo, useEffect } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import type { DashboardFilter } from '@/hooks/useDashboardStats'
import { LocationMap } from '@/components/LocationMap'
import { useAuthStore } from '@/store/authStore'

const FILTER_OPTIONS: { value: DashboardFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'procesos', label: 'Procesos' },
  { value: 'clientes_externos', label: 'Clientes Externos' },
  { value: 'puntos_venta', label: 'Puntos de Venta' },
  { value: 'conductores', label: 'Conductores' },
]

export function DashboardPage() {
  const stats = useDashboardStats()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'
  const canSeeLocations = isSuperAdmin || user?.role === 'consultor_proceso'

  const [activeFilter, setActiveFilter] = useState<DashboardFilter>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Filtrar locations por categoría y búsqueda
  const filteredLocations = useMemo(() => {
    let filtered = stats.locations

    if (activeFilter !== 'todos') {
      filtered = filtered.filter(l => l.filterCategory === activeFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.ubicacion.toLowerCase().includes(q) ||
        l.area.toLowerCase().includes(q)
      )
    }

    return filtered
  }, [stats.locations, activeFilter, searchQuery])

  // Recalcular totales según filtro
  const filteredTotals = useMemo(() => {
    if (activeFilter === 'todos' && !searchQuery.trim()) {
      return {
        total: stats.totalCanastillas,
        disponibles: stats.disponibles,
      }
    }
    return filteredLocations.reduce((acc, l) => ({
      total: acc.total + l.total,
      disponibles: acc.disponibles + l.disponibles,
    }), { total: 0, disponibles: 0 })
  }, [filteredLocations, activeFilter, searchQuery, stats])

  const disponiblesPercent = filteredTotals.total > 0
    ? Math.round((filteredTotals.disponibles / filteredTotals.total) * 100)
    : 0

  if (stats.loading) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Resumen general del sistema">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Resumen general del sistema"
    >
      <div className="space-y-6">
        {/* Reloj en tiempo real */}
        <div className="flex justify-start items-center">
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 capitalize">
                {currentTime.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-600"></div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-lg font-mono font-bold text-gray-900 dark:text-white tracking-wider">
                {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          {/* Card 1 - Total Canastillas */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/80">Total</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{filteredTotals.total}</p>
                <p className="text-xs text-white/60 mt-1 hidden sm:block">Inventario total</p>
              </div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm flex-shrink-0 ml-2">
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Card 2 - Disponibles */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/80">Disponibles</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{filteredTotals.disponibles}</p>
                <p className="text-xs text-white/60 mt-1">{disponiblesPercent}% del total</p>
              </div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm flex-shrink-0 ml-2">
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Card del usuario actual (para no-superadmin) - misma card que en superadmin */}
        {!canSeeLocations && user && (() => {
          const myLocations = stats.locations.filter(l => l.userId === user.id)
          return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Mi Inventario</h2>
              <LocationMap locations={myLocations} />
            </div>
          )
        })()}

        {/* Canastillas por Usuario */}
        {canSeeLocations && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-6">
            {/* Título + Buscador */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Canastillas por Usuario</h2>

              <div className="relative w-full sm:w-64">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar usuario..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                />
              </div>
            </div>

            {/* Filtros por tipo */}
            <div className="flex flex-wrap gap-2 mb-4">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setActiveFilter(opt.value)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                    activeFilter === opt.value
                      ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {opt.label}
                  {activeFilter === opt.value && (
                    <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                      {filteredLocations.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <LocationMap locations={filteredLocations} />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}