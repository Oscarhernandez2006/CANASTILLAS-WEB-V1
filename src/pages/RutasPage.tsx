/**
 * @module RutasPage
 * @description Gestión de rutas de entrega: crear, asignar conductor, seguimiento.
 */
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { useRoutes } from '@/hooks/useRoutes'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'
import { CrearRutaModal } from '@/components/CrearRutaModal'
import { DetalleRutaModal } from '@/components/DetalleRutaModal'
import type { DeliveryRoute } from '@/types'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  EN_CURSO: { label: 'En Curso', color: 'bg-blue-100 text-blue-800', icon: '🚚' },
  COMPLETADA: { label: 'Completada', color: 'bg-green-100 text-green-800', icon: '✅' },
  CANCELADA: { label: 'Cancelada', color: 'bg-red-100 text-red-800', icon: '❌' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function RutasPage() {
  const { user } = useAuthStore()
  const { hasPermission } = usePermissions()
  const {
    routes, loading, drivers,
    statusFilter, driverFilter,
    setStatusFilter, setDriverFilter,
    createRoute, assignDriver, updateStatus,
    refetch,
  } = useRoutes()

  const [showCrear, setShowCrear] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<DeliveryRoute | null>(null)

  const canCreate = hasPermission('rutas.crear')
  const canAssign = hasPermission('rutas.asignar')

  // Stats
  const pendientes = routes.filter(r => r.status === 'PENDIENTE').length
  const enCurso = routes.filter(r => r.status === 'EN_CURSO').length
  const completadas = routes.filter(r => r.status === 'COMPLETADA').length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rutas de Entrega</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Planifica y monitorea rutas de entrega y recolección
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCrear(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium text-sm shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Ruta
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{routes.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Rutas</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800/30">
            <p className="text-2xl font-bold text-yellow-600">{pendientes}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pendientes</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-blue-200 dark:border-blue-800/30">
            <p className="text-2xl font-bold text-blue-600">{enCurso}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">En Curso</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-green-200 dark:border-green-800/30">
            <p className="text-2xl font-bold text-green-600">{completadas}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Completadas</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_CURSO">En Curso</option>
            <option value="COMPLETADA">Completada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
          <select
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Todos los conductores</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Lista de rutas */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : routes.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-lg">No hay rutas registradas</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Crea una nueva ruta para comenzar</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {routes.map((route) => {
              const stopsCount = route.stops?.length || 0
              const completedStops = route.stops?.filter(s => s.status === 'COMPLETADA').length || 0
              const config = STATUS_CONFIG[route.status] || STATUS_CONFIG.PENDIENTE
              const totalCanastillas = route.stops?.reduce((sum, s) => sum + (s.canastillas_qty || 0), 0) || 0

              return (
                <div
                  key={route.id}
                  onClick={() => setSelectedRoute(route)}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">{route.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                          {config.icon} {config.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>📅 {formatDate(route.scheduled_date)}</span>
                        <span>📍 {stopsCount} paradas</span>
                        <span>📦 {totalCanastillas} canastillas</span>
                        {route.driver_name && <span>🚚 {route.driver_name}</span>}
                      </div>
                      {route.description && (
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 truncate">{route.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {stopsCount > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${stopsCount > 0 ? (completedStops / stopsCount) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {completedStops}/{stopsCount}
                          </span>
                        </div>
                      )}
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modales */}
      {showCrear && (
        <CrearRutaModal
          drivers={drivers}
          onClose={() => setShowCrear(false)}
          onCreate={async (params) => {
            await createRoute({
              ...params,
              createdBy: user!.id,
              createdByName: `${user!.first_name} ${user!.last_name || ''}`.trim(),
            })
            setShowCrear(false)
          }}
        />
      )}

      {selectedRoute && (
        <DetalleRutaModal
          route={selectedRoute}
          drivers={drivers}
          canAssign={canAssign}
          onClose={() => { setSelectedRoute(null); refetch() }}
          onAssignDriver={assignDriver}
          onUpdateStatus={updateStatus}
        />
      )}
    </DashboardLayout>
  )
}
