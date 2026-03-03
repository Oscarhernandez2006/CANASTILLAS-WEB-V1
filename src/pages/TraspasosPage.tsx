import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { SolicitarTraspasoModal } from '@/components/SolicitarTraspasoModal'
import { useTraspasos } from '@/hooks/useTraspasos'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/utils/helpers'
import { openRemisionTraspasoPDF } from '@/utils/remisionTraspasoGenerator'
import type { Transfer } from '@/types'

type TabType = 'solicitudes-recibidas' | 'solicitudes-enviadas' | 'historial'

export function TraspasosPage() {
  const [activeTab, setActiveTab] = useState<TabType>('solicitudes-recibidas')
  const [showSolicitarModal, setShowSolicitarModal] = useState(false)

  const { user } = useAuthStore()
  const {
    solicitudesRecibidas,
    solicitudesEnviadas,
    historial,
    loading,
    refreshTraspasos
  } = useTraspasos()

  const handleAprobar = async (id: string) => {
    if (!confirm('¿Aprobar este traspaso?')) return

    try {
      const now = new Date().toISOString()

      // Obtener el transfer primero para verificar si es de lavado
      const { data: transferData } = await supabase
        .from('transfers')
        .select('is_washing_transfer')
        .eq('id', id)
        .single()

      const isWashingTransfer = transferData?.is_washing_transfer || false

      // Actualizar el estado a ACEPTADO (la remisión ya fue generada al crear la solicitud)
      const { error } = await supabase
        .from('transfers')
        .update({
          status: 'ACEPTADO',
          responded_at: now
        })
        .eq('id', id)

      if (error) throw error

      // Obtener el transfer base sin items (para evitar límite de 1000)
      const { data: transferBase } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:users!transfers_from_user_id_fkey(*),
          to_user:users!transfers_to_user_id_fkey(*)
        `)
        .eq('id', id)
        .single()

      if (transferBase) {
        // Obtener TODOS los transfer_items con paginación
        const PAGE_SIZE_ITEMS = 1000
        let allTransferItems: any[] = []
        let hasMoreItems = true
        let offsetItems = 0

        while (hasMoreItems) {
          const { data: itemsBatch, error: itemsError } = await supabase
            .from('transfer_items')
            .select('*, canastilla:canastillas(*)')
            .eq('transfer_id', id)
            .range(offsetItems, offsetItems + PAGE_SIZE_ITEMS - 1)

          if (itemsError) throw itemsError

          if (itemsBatch && itemsBatch.length > 0) {
            allTransferItems = [...allTransferItems, ...itemsBatch]
            offsetItems += PAGE_SIZE_ITEMS
            hasMoreItems = itemsBatch.length === PAGE_SIZE_ITEMS
          } else {
            hasMoreItems = false
          }
        }

        // Combinar transfer con todos sus items
        const transfer = {
          ...transferBase,
          transfer_items: allTransferItems
        }

        const canastillaIds = transfer.transfer_items.map((item: any) => item.canastilla_id)

        // Cambiar el propietario y estado de las canastillas
        // Si es envío a lavado: estado EN_LAVADO
        // Si es traspaso normal: estado DISPONIBLE
        const newStatus = isWashingTransfer ? 'EN_LAVADO' : 'DISPONIBLE'

        // Obtener ubicación y área del usuario receptor para la trazabilidad
        const newLocation = transfer.to_user?.department || null
        const newArea = transfer.to_user?.area || null

        // Actualizar en lotes de 500 para evitar límite de Supabase
        const BATCH_SIZE = 500
        for (let i = 0; i < canastillaIds.length; i += BATCH_SIZE) {
          const batch = canastillaIds.slice(i, i + BATCH_SIZE)
          const { error: updateError } = await supabase
            .from('canastillas')
            .update({
              current_owner_id: transfer.to_user_id,
              status: newStatus,
              current_location: newLocation,  // Actualizar ubicación con la del usuario receptor
              current_area: newArea           // Actualizar área con la del usuario receptor
            })
            .in('id', batch)

          if (updateError) throw updateError
        }

        // Abrir la remisión PDF
        await openRemisionTraspasoPDF(transfer as unknown as Transfer)

        const successMessage = isWashingTransfer
          ? '✅ Canastillas recibidas para lavado. Remisión: ' + (transfer.remision_number || '')
          : '✅ Traspaso aprobado exitosamente. Remisión: ' + (transfer.remision_number || '')
        alert(successMessage)
      }

      refreshTraspasos()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    }
  }

  const handleVerRemision = async (transfer: any) => {
    try {
      // Obtener el transfer base sin items (para evitar límite de 1000)
      const { data: transferBase } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:users!transfers_from_user_id_fkey(*),
          to_user:users!transfers_to_user_id_fkey(*)
        `)
        .eq('id', transfer.id)
        .single()

      if (transferBase) {
        // Obtener TODOS los transfer_items con paginación
        const PAGE_SIZE_ITEMS = 1000
        let allTransferItems: any[] = []
        let hasMoreItems = true
        let offsetItems = 0

        while (hasMoreItems) {
          const { data: itemsBatch, error: itemsError } = await supabase
            .from('transfer_items')
            .select('*, canastilla:canastillas(*)')
            .eq('transfer_id', transfer.id)
            .range(offsetItems, offsetItems + PAGE_SIZE_ITEMS - 1)

          if (itemsError) throw itemsError

          if (itemsBatch && itemsBatch.length > 0) {
            allTransferItems = [...allTransferItems, ...itemsBatch]
            offsetItems += PAGE_SIZE_ITEMS
            hasMoreItems = itemsBatch.length === PAGE_SIZE_ITEMS
          } else {
            hasMoreItems = false
          }
        }

        // Combinar transfer con todos sus items
        const fullTransfer = {
          ...transferBase,
          transfer_items: allTransferItems
        }

        await openRemisionTraspasoPDF(fullTransfer as unknown as Transfer)
      }
    } catch (error: any) {
      alert('❌ Error al generar la remisión: ' + error.message)
    }
  }

  const handleRechazar = async (id: string) => {
    if (!confirm('¿Rechazar este traspaso?')) return

    try {
      const { error } = await supabase
        .from('transfers')
        .update({ 
          status: 'RECHAZADO',
          responded_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      alert('✅ Traspaso rechazado')
      refreshTraspasos()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    }
  }

  const handleCancelar = async (id: string) => {
    if (!confirm('¿Cancelar esta solicitud de traspaso?')) return

    try {
      // Cambiar el estado a CANCELADO (en lugar de eliminar)
      const { error } = await supabase
        .from('transfers')
        .update({
          status: 'CANCELADO',
          responded_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      // Nota: Las canastillas NO necesitan devolverse porque nunca cambiaron de dueño
      // El cambio de current_owner_id solo ocurre cuando se APRUEBA el traspaso

      alert('✅ Solicitud cancelada exitosamente')
      refreshTraspasos()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      PENDIENTE: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
      ACEPTADO: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aceptado' },
      RECHAZADO: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rechazado' },
      CANCELADO: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelado' },
    }

    const badge = badges[status] || badges.PENDIENTE

    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  return (
    <DashboardLayout 
      title="Traspasos" 
      subtitle="Gestión de movimientos de canastillas entre usuarios"
    >
      <div className="space-y-6">
        {/* Botón Solicitar Traspaso */}
        <div className="flex justify-end">
          <Button onClick={() => setShowSolicitarModal(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Solicitar Traspaso
          </Button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('solicitudes-recibidas')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors relative ${
                activeTab === 'solicitudes-recibidas'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">📥 </span>Recibidas
              {(solicitudesRecibidas || []).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[10px] sm:text-xs">
                  {solicitudesRecibidas.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('solicitudes-enviadas')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'solicitudes-enviadas'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">📤 </span>Enviadas
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'historial'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">📋 </span>Historial
            </button>
          </div>
        </div>

        {/* Tab: Solicitudes Recibidas */}
        {activeTab === 'solicitudes-recibidas' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (solicitudesRecibidas || []).length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-lg font-medium text-gray-900">No hay solicitudes recibidas</p>
                <p className="text-sm text-gray-500 mt-1">Aquí aparecerán las solicitudes de traspaso que te envíen</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">De</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canastillas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(solicitudesRecibidas || []).map((solicitud) => (
                      <tr key={solicitud.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {solicitud.from_user?.first_name} {solicitud.from_user?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {solicitud.from_user?.email}
                          </div>
                          {solicitud.remision_number && (
                            <div className="text-xs text-purple-600 font-medium mt-1">
                              {solicitud.remision_number}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {solicitud.items_count ?? (solicitud.transfer_items || []).length} canastillas
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {formatDate(solicitud.requested_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(solicitud.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end space-x-2">
                            {solicitud.remision_number && (
                              <button
                                onClick={() => handleVerRemision(solicitud)}
                                className="inline-flex items-center text-purple-600 hover:text-purple-900 font-medium text-sm"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Remisión
                              </button>
                            )}
                            {solicitud.status === 'PENDIENTE' && (
                              <>
                                <button
                                  onClick={() => handleAprobar(solicitud.id)}
                                  className="text-green-600 hover:text-green-900 font-medium"
                                >
                                  Aprobar
                                </button>
                                <button
                                  onClick={() => handleRechazar(solicitud.id)}
                                  className="text-red-600 hover:text-red-900 font-medium"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}
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

        {/* Tab: Solicitudes Enviadas */}
        {activeTab === 'solicitudes-enviadas' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (solicitudesEnviadas || []).length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <p className="text-lg font-medium text-gray-900">No has enviado solicitudes</p>
                <p className="text-sm text-gray-500 mt-1">
                  Selecciona canastillas y haz clic en "Solicitar Traspaso"
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Para</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canastillas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(solicitudesEnviadas || []).map((solicitud) => (
                      <tr key={solicitud.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {solicitud.to_user?.first_name} {solicitud.to_user?.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {solicitud.to_user?.email}
                          </div>
                          {solicitud.remision_number && (
                            <div className="text-xs text-purple-600 font-medium mt-1">
                              {solicitud.remision_number}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {solicitud.items_count ?? (solicitud.transfer_items || []).length} canastillas
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {formatDate(solicitud.requested_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(solicitud.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end space-x-2">
                            {solicitud.remision_number && (
                              <button
                                onClick={() => handleVerRemision(solicitud)}
                                className="inline-flex items-center text-purple-600 hover:text-purple-900 font-medium text-sm"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Remisión
                              </button>
                            )}
                            {solicitud.status === 'PENDIENTE' && (
                              <button
                                onClick={() => handleCancelar(solicitud.id)}
                                className="text-red-600 hover:text-red-900 font-medium"
                              >
                                Cancelar
                              </button>
                            )}
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

        {/* Tab: Historial */}
        {activeTab === 'historial' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : (historial || []).length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">Sin historial</p>
                <p className="text-sm text-gray-500 mt-1">
                  Aquí aparecerán los traspasos completados o rechazados
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">De → Para</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canastillas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(historial || []).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <span className="font-medium text-gray-900">
                              {item.from_user?.first_name} {item.from_user?.last_name}
                            </span>
                            <span className="text-gray-500 mx-2">→</span>
                            <span className="font-medium text-gray-900">
                              {item.to_user?.first_name} {item.to_user?.last_name}
                            </span>
                          </div>
                          {item.remision_number && (
                            <div className="text-xs text-purple-600 font-medium mt-1">
                              {item.remision_number}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {item.items_count ?? (item.transfer_items || []).length} canastillas
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {formatDate(item.responded_at || item.requested_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.status === 'ACEPTADO' && item.remision_number && (
                            <button
                              onClick={() => handleVerRemision(item)}
                              className="inline-flex items-center text-purple-600 hover:text-purple-900 font-medium text-sm"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Ver Remisión
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Solicitar Traspaso */}
      <SolicitarTraspasoModal
        isOpen={showSolicitarModal}
        onClose={() => setShowSolicitarModal(false)}
        onSuccess={() => refreshTraspasos()}
      />
    </DashboardLayout>
  )
}