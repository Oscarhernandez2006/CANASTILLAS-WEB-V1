import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { CrearAlquilerModal } from '@/components/CrearAlquilerModal'
import { ProcesarRetornoModal } from '@/components/ProcesarRetornoModal'
import { DetalleAlquilerModal } from '@/components/DetalleAlquilerModal'
import { useRentals } from '@/hooks/useRentals'
import { useRentalSettings } from '@/hooks/useRentalSettings'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { openInvoicePDF, downloadInvoicePDF } from '@/utils/pdfGenerator'
import { openRemisionPDF } from '@/utils/remisionGenerator'
import type { Rental } from '@/types'

type TabType = 'activos' | 'historial' | 'configuracion'

export function AlquileresPage() {
  const [activeTab, setActiveTab] = useState<TabType>('activos')
  const [showCrearModal, setShowCrearModal] = useState(false)
  const [showRetornoModal, setShowRetornoModal] = useState(false)
  const [showDetalleModal, setShowDetalleModal] = useState(false)
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null)

  // Estados para edición de configuración
  const [isEditingConfig, setIsEditingConfig] = useState(false)
  const [editDailyRate, setEditDailyRate] = useState<string>('')
  const [editInternalRate, setEditInternalRate] = useState<string>('')
  const [savingConfig, setSavingConfig] = useState(false)

  const { activeRentals, completedRentals, loading, refreshRentals } = useRentals()
  const { settings, loading: loadingSettings, updateSettings, refreshSettings } = useRentalSettings()
  const permissions = usePermissions()
  const { user } = useAuthStore()

  // super_admin y admin pueden crear alquileres
  const canCreateRental = user?.role === 'super_admin' || user?.role === 'admin'

  // Permiso para editar configuración: super_admin o quien tenga el permiso
  const canEditConfig = user?.role === 'super_admin' || permissions.hasPermission('alquileres.editar_configuracion')

  // Sincronizar valores de edición cuando settings cargue
  useEffect(() => {
    if (settings && !isEditingConfig) {
      setEditDailyRate(settings.daily_rate?.toString() || '')
      setEditInternalRate(settings.internal_rate?.toString() || '')
    }
  }, [settings, isEditingConfig])

  const calculateCurrentDays = (startDate: string) => {
    const start = new Date(startDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays) // Mínimo 1 día
  }

  const calculateCurrentTotal = (startDate: string, canastillasCount: number, dailyRate: number) => {
    const days = calculateCurrentDays(startDate)
    return days * canastillasCount * dailyRate
  }

  return (
    <DashboardLayout 
      title="Alquileres" 
      subtitle="Gestión de alquileres de canastillas"
    >
      <div className="space-y-6">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
          <div className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('activos')}
              className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'activos'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">Alquileres </span>Activos ({activeRentals.length})
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'historial'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Historial
            </button>
            <button
              onClick={() => setActiveTab('configuracion')}
              className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'configuracion'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">Configura</span><span className="sm:hidden">Config</span><span className="hidden sm:inline">ción</span>
            </button>
          </div>
        </div>

        {/* Header con botón crear */}
        {activeTab === 'activos' && canCreateRental && (
          <div className="flex justify-end">
            <Button onClick={() => setShowCrearModal(true)}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Alquiler
            </Button>
          </div>
        )}

        {/* Tab: Alquileres Activos */}
        {activeTab === 'activos' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : activeRentals.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">No hay alquileres activos</p>
                <p className="text-sm text-gray-500 mt-1">Los alquileres activos aparecerán aquí</p>
                {canCreateRental && (
                  <Button className="mt-4" onClick={() => setShowCrearModal(true)}>
                    Crear Primer Alquiler
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {activeRentals.map((rental) => {
                  const currentDays = calculateCurrentDays(rental.start_date)
                  const totalOriginal = (rental as any).items_count ?? rental.rental_items?.length ?? 0

                  // Calcular contadores de devoluciones desde rental_returns (más confiable)
                  const returnedFromReturns = (rental as any).rental_returns?.reduce((sum: number, ret: any) => {
                    return sum + (ret.rental_return_items?.length || 0)
                  }, 0) || 0

                  // Usar returned_items_count de BD o calcularlo desde rental_returns
                  const returnedCount = (rental as any).returned_items_count || returnedFromReturns

                  // Calcular pending: si pending_items_count es válido usarlo, sino calcular
                  let pendingCount = (rental as any).pending_items_count
                  if (pendingCount === null || pendingCount === undefined) {
                    pendingCount = totalOriginal - returnedCount
                  } else if (pendingCount === 0 && totalOriginal > 0 && returnedCount < totalOriginal) {
                    // Inconsistencia: pending es 0 pero hay canastillas sin devolver - recalcular
                    pendingCount = totalOriginal - returnedCount
                  }
                  pendingCount = Math.max(0, pendingCount) // Asegurar que no sea negativo

                  const totalInvoiced = (rental as any).total_invoiced ?? 0
                  const hasPartialReturns = returnedCount > 0

                  // Calcular total actual solo de las pendientes
                  const currentTotal = rental.rental_type === 'INTERNO'
                    ? pendingCount * rental.daily_rate
                    : currentDays * pendingCount * rental.daily_rate

                  return (
                    <div key={rental.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {rental.sale_point?.name}
                            </h3>
                            <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              ACTIVO
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              rental.rental_type === 'INTERNO'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-pink-100 text-pink-800'
                            }`}>
                              {rental.rental_type}
                            </span>
                            {hasPartialReturns && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                PARCIAL
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{rental.sale_point?.contact_name}</p>
                          <p className="text-sm text-gray-500">{rental.sale_point?.contact_phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary-600">
                            {formatCurrency(currentTotal)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Total pendiente</p>
                          {totalInvoiced > 0 && (
                            <p className="text-xs text-green-600 mt-1">
                              Facturado: {formatCurrency(totalInvoiced)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Indicador de devoluciones parciales */}
                      {hasPartialReturns && (
                        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span className="text-sm font-medium text-orange-800">Devolución Parcial</span>
                            </div>
                            <div className="text-sm text-orange-700">
                              <span className="font-semibold text-green-700">{returnedCount}</span> devueltas /
                              <span className="font-semibold text-orange-700 ml-1">{pendingCount}</span> pendientes
                            </div>
                          </div>
                          <div className="mt-2 w-full bg-orange-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${(returnedCount / totalOriginal) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">
                            {hasPartialReturns ? 'Pendientes' : 'Canastillas'}
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {pendingCount}
                            {hasPartialReturns && (
                              <span className="text-xs text-gray-500 ml-1">de {totalOriginal}</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Días</p>
                          <p className="text-sm font-semibold text-gray-900">{currentDays}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tarifa</p>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(rental.daily_rate)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Salida</p>
                          <p className="text-sm font-semibold text-gray-900">{formatDate(rental.start_date)}</p>
                        </div>
                      </div>

                      {rental.estimated_return_date && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs font-medium text-blue-900">Retorno estimado:</p>
                          <p className="text-sm text-blue-800">{formatDate(rental.estimated_return_date)}</p>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => {
                            setSelectedRental(rental)
                            setShowDetalleModal(true)
                          }}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium text-center sm:text-left"
                        >
                          Ver detalles
                        </button>
                        <Button
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => {
                            setSelectedRental(rental)
                            setShowRetornoModal(true)
                          }}
                        >
                          Procesar Retorno
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Historial */}
        {activeTab === 'historial' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : completedRentals.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">No hay historial</p>
                <p className="text-sm text-gray-500 mt-1">Los alquileres completados aparecerán aquí</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Factura
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Canastillas
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Días
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {completedRentals.map((rental) => (
                      <tr key={rental.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">{rental.invoice_number || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{formatDate(rental.actual_return_date || rental.start_date)}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">{rental.sale_point?.name}</p>
                          <p className="text-xs text-gray-500">{rental.sale_point?.contact_name}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(rental as any).items_count ?? rental.rental_items?.length ?? 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {rental.actual_days || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(rental.total_amount || 0)}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            rental.status === 'RETORNADO' ? 'bg-green-100 text-green-800' :
                            rental.status === 'VENCIDO' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {rental.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {rental.remision_number && (
                              <>
                                <button
                                  onClick={() => openRemisionPDF(rental, rental.remision_number!)}
                                  className="text-cyan-600 hover:text-cyan-900 text-sm font-medium"
                                  title="Ver Remisión"
                                >
                                  Remisión
                                </button>
                                <span className="text-gray-300">|</span>
                              </>
                            )}
                            <button
                              onClick={() => openInvoicePDF(rental)}
                              className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                              title="Ver Factura"
                            >
                              Factura
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => downloadInvoicePDF(rental)}
                              className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                              title="Descargar Factura"
                            >
                              Descargar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Configuración */}
        {activeTab === 'configuracion' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Configuración de Tarifas</h3>
              {canEditConfig && !isEditingConfig && !loadingSettings && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditDailyRate(settings?.daily_rate || 0)
                    setEditInternalRate(settings?.internal_rate || 0)
                    setIsEditingConfig(true)
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Editar Tarifas
                </Button>
              )}
            </div>

            {loadingSettings ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : !settings ? (
              <div className="text-center py-8">
                <div className="text-amber-600 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">No se encontró configuración de tarifas</p>
                <p className="text-gray-500 text-sm mt-1">
                  Ejecuta el archivo <code className="bg-gray-100 px-1 rounded">fix_rental_settings_complete.sql</code> en Supabase
                </p>
              </div>
            ) : (
              <>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              {/* Tarifa Externa (por día) */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-pink-100 text-pink-800">
                    EXTERNO
                  </span>
                  <h4 className="text-sm font-medium text-gray-700">Tarifa por Día</h4>
                </div>

                {isEditingConfig ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editDailyRate}
                      onChange={(e) => setEditDailyRate(e.target.value)}
                      placeholder="0"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-gray-500">COP</span>
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(settings?.daily_rate || 0)}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  Se cobra por cada día que el cliente tenga las canastillas
                </p>
              </div>

              {/* Tarifa Interna (fija) */}
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                    INTERNO
                  </span>
                  <h4 className="text-sm font-medium text-gray-700">Tarifa Fija</h4>
                </div>

                {isEditingConfig ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editInternalRate}
                      onChange={(e) => setEditInternalRate(e.target.value)}
                      placeholder="0"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-gray-500">COP</span>
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(settings?.internal_rate || 0)}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  Tarifa única sin importar la cantidad de días
                </p>
              </div>
            </div>

            {/* Botones de guardar/cancelar */}
            {isEditingConfig && (
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-200">
                <Button
                  onClick={async () => {
                    if (!user) return
                    // Convertir strings a números y validar
                    const dailyRateNum = parseFloat(editDailyRate) || 0
                    const internalRateNum = parseFloat(editInternalRate) || 0

                    if (dailyRateNum < 0 || internalRateNum < 0) {
                      alert('❌ Las tarifas no pueden ser negativas')
                      return
                    }

                    setSavingConfig(true)
                    const result = await updateSettings(dailyRateNum, internalRateNum, user.id)
                    setSavingConfig(false)
                    if (result.success) {
                      alert('✅ Tarifas actualizadas correctamente')
                      setIsEditingConfig(false)
                      refreshSettings()
                    } else {
                      alert('❌ Error al guardar: ' + result.error)
                    }
                  }}
                  loading={savingConfig}
                  disabled={savingConfig}
                >
                  {savingConfig ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditingConfig(false)}
                  disabled={savingConfig}
                >
                  Cancelar
                </Button>
              </div>
            )}

            {/* Información adicional */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Cómo funcionan las tarifas:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Externa:</strong> Total = Canastillas × Tarifa diaria × Días</li>
                <li>• <strong>Interna:</strong> Total = Canastillas × Tarifa fija (sin importar días)</li>
              </ul>
            </div>

            {!canEditConfig && (
              <p className="text-sm text-gray-500 mt-4 p-3 bg-gray-50 rounded-lg">
                <strong>Nota:</strong> No tienes permisos para editar las tarifas. Contacta al administrador.
              </p>
            )}

            {/* Última actualización */}
            {settings?.updated_at && (
              <p className="text-xs text-gray-400 mt-4">
                Última actualización: {formatDate(settings.updated_at)}
              </p>
            )}
            </>
            )}
          </div>
        )}
      </div>

      {/* Modal de Crear Alquiler */}
      <CrearAlquilerModal
        isOpen={showCrearModal}
        onClose={() => setShowCrearModal(false)}
        onSuccess={() => {
          refreshRentals()
          setShowCrearModal(false)
        }}
      />

      {/* Modal de Procesar Retorno */}
      <ProcesarRetornoModal
        isOpen={showRetornoModal}
        onClose={() => {
          setShowRetornoModal(false)
          setSelectedRental(null)
        }}
        onSuccess={() => {
          refreshRentals()
          setShowRetornoModal(false)
          setSelectedRental(null)
        }}
        rental={selectedRental}
      />

      {/* Modal de Detalle de Alquiler */}
      <DetalleAlquilerModal
        isOpen={showDetalleModal}
        onClose={() => {
          setShowDetalleModal(false)
          setSelectedRental(null)
        }}
        rental={selectedRental}
      />
    </DashboardLayout>
  )
}