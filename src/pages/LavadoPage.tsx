import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { LavadoCard } from '@/components/LavadoCard'
import { EnviarLavadoModal } from '@/components/EnviarLavadoModal'
import { RecibirLavadoModal } from '@/components/RecibirLavadoModal'
import { MarcarLavadoModal } from '@/components/MarcarLavadoModal'
import { EntregarLavadoModal } from '@/components/EntregarLavadoModal'
import { ConfirmarRecepcionLavadoModal } from '@/components/ConfirmarRecepcionLavadoModal'
import { DetalleLavadoModal } from '@/components/DetalleLavadoModal'
import { useLavado } from '@/hooks/useLavado'
import { usePermissions } from '@/hooks/usePermissions'
import { cancelOrder } from '@/services/washingService'
import type { WashingOrder } from '@/types'

type TabType = 'mis-envios' | 'por-confirmar' | 'por-recibir' | 'en-proceso' | 'por-entregar' | 'historial'

export function LavadoPage() {
  const {
    loading,
    misEnvios,
    porConfirmar,
    porRecibir,
    enProceso,
    porEntregar,
    historial,
    contadores,
    isWashingStaff,
    refreshLavado,
  } = useLavado()

  const { hasPermission } = usePermissions()

  // Estado para tabs
  const [activeTab, setActiveTab] = useState<TabType>(isWashingStaff ? 'por-recibir' : 'mis-envios')

  // Estado para modales
  const [showEnviarModal, setShowEnviarModal] = useState(false)
  const [showRecibirModal, setShowRecibirModal] = useState(false)
  const [showMarcarModal, setShowMarcarModal] = useState(false)
  const [showEntregarModal, setShowEntregarModal] = useState(false)
  const [showConfirmarModal, setShowConfirmarModal] = useState(false)
  const [showDetalleModal, setShowDetalleModal] = useState(false)

  // Orden seleccionada para modales
  const [selectedOrder, setSelectedOrder] = useState<WashingOrder | null>(null)

  const handleCancelar = async (order: WashingOrder) => {
    const reason = prompt('Razón de la cancelación (opcional):')
    if (reason === null) return // Usuario canceló el prompt

    try {
      await cancelOrder(order.id, reason || undefined)
      alert('Orden cancelada exitosamente')
      refreshLavado()
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const openModal = (modal: 'recibir' | 'marcar' | 'entregar' | 'confirmar' | 'detalle', order: WashingOrder) => {
    setSelectedOrder(order)
    switch (modal) {
      case 'recibir': setShowRecibirModal(true); break
      case 'marcar': setShowMarcarModal(true); break
      case 'entregar': setShowEntregarModal(true); break
      case 'confirmar': setShowConfirmarModal(true); break
      case 'detalle': setShowDetalleModal(true); break
    }
  }

  const renderEmptyState = (message: string, subtitle: string) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
      <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
      <p className="text-lg font-medium text-gray-900">{message}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  )

  const renderLoading = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    </div>
  )

  // Tabs para usuarios normales
  const userTabs = [
    { id: 'mis-envios' as TabType, label: 'Mis Envíos', count: contadores.misEnvios, icon: '📤' },
    { id: 'por-confirmar' as TabType, label: 'Por Confirmar', count: contadores.porConfirmar, icon: '✅' },
    { id: 'historial' as TabType, label: 'Historial', count: 0, icon: '📋' },
  ]

  // Tabs para personal de lavado
  const staffTabs = [
    { id: 'por-recibir' as TabType, label: 'Por Recibir', count: contadores.porRecibir, icon: '📥' },
    { id: 'en-proceso' as TabType, label: 'En Proceso', count: contadores.enProceso, icon: '🔄' },
    { id: 'por-entregar' as TabType, label: 'Por Entregar', count: contadores.porEntregar, icon: '📦' },
    { id: 'historial' as TabType, label: 'Historial', count: 0, icon: '📋' },
  ]

  const tabs = isWashingStaff ? staffTabs : userTabs

  return (
    <DashboardLayout
      title="Lavado de Canastillas"
      subtitle={isWashingStaff ? 'Gestión de órdenes de lavado' : 'Envía tus canastillas a lavado'}
    >
      <div className="space-y-6">
        {/* Botón Enviar a Lavado (solo para usuarios normales) */}
        {!isWashingStaff && hasPermission('lavado.enviar') && (
          <div className="flex justify-end">
            <Button onClick={() => setShowEnviarModal(true)} className="bg-blue-600 hover:bg-blue-700">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Enviar a Lavado
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
          <div className={`grid grid-cols-${tabs.length} gap-2`}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 rounded-lg font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.icon} {tab.label}
                {tab.count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido de tabs */}
        {loading ? renderLoading() : (
          <>
            {/* Tab: Mis Envíos (usuarios normales) */}
            {activeTab === 'mis-envios' && !isWashingStaff && (
              misEnvios.length === 0 ? (
                renderEmptyState('No has enviado canastillas a lavado', 'Selecciona canastillas y haz clic en "Enviar a Lavado"')
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {misEnvios.map((order) => (
                    <LavadoCard
                      key={order.id}
                      order={order}
                      showStaff
                      onView={() => openModal('detalle', order)}
                      onAction={order.status === 'ENVIADO' ? () => handleCancelar(order) : undefined}
                      actionLabel={order.status === 'ENVIADO' ? 'Cancelar' : undefined}
                      actionColor="bg-red-600 hover:bg-red-700"
                    />
                  ))}
                </div>
              )
            )}

            {/* Tab: Por Confirmar (usuarios normales) */}
            {activeTab === 'por-confirmar' && !isWashingStaff && (
              porConfirmar.length === 0 ? (
                renderEmptyState('No hay canastillas por confirmar', 'Aquí aparecerán las canastillas lavadas listas para confirmar recepción')
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {porConfirmar.map((order) => (
                    <LavadoCard
                      key={order.id}
                      order={order}
                      showStaff
                      onView={() => openModal('detalle', order)}
                      onAction={() => openModal('confirmar', order)}
                      actionLabel="Confirmar Recepción"
                      actionColor="bg-teal-600 hover:bg-teal-700"
                    />
                  ))}
                </div>
              )
            )}

            {/* Tab: Por Recibir (personal de lavado) */}
            {activeTab === 'por-recibir' && isWashingStaff && (
              porRecibir.length === 0 ? (
                renderEmptyState('No hay órdenes por recibir', 'Aquí aparecerán las órdenes de lavado enviadas por los usuarios')
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {porRecibir.map((order) => (
                    <LavadoCard
                      key={order.id}
                      order={order}
                      showSender
                      onView={() => openModal('detalle', order)}
                      onAction={() => openModal('recibir', order)}
                      actionLabel="Recibir"
                      actionColor="bg-green-600 hover:bg-green-700"
                    />
                  ))}
                </div>
              )
            )}

            {/* Tab: En Proceso (personal de lavado) */}
            {activeTab === 'en-proceso' && isWashingStaff && (
              enProceso.length === 0 ? (
                renderEmptyState('No hay órdenes en proceso', 'Recibe órdenes para comenzar el lavado')
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {enProceso.map((order) => (
                    <LavadoCard
                      key={order.id}
                      order={order}
                      showSender
                      onView={() => openModal('detalle', order)}
                      onAction={() => openModal('marcar', order)}
                      actionLabel="Marcar Completado"
                      actionColor="bg-purple-600 hover:bg-purple-700"
                    />
                  ))}
                </div>
              )
            )}

            {/* Tab: Por Entregar (personal de lavado) */}
            {activeTab === 'por-entregar' && isWashingStaff && (
              porEntregar.length === 0 ? (
                renderEmptyState('No hay órdenes por entregar', 'Las órdenes completadas aparecerán aquí')
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {porEntregar.map((order) => (
                    <LavadoCard
                      key={order.id}
                      order={order}
                      showSender
                      onView={() => openModal('detalle', order)}
                      onAction={() => openModal('entregar', order)}
                      actionLabel="Entregar"
                      actionColor="bg-orange-600 hover:bg-orange-700"
                    />
                  ))}
                </div>
              )
            )}

            {/* Tab: Historial */}
            {activeTab === 'historial' && (
              historial.length === 0 ? (
                renderEmptyState('Sin historial', 'Aquí aparecerán las órdenes completadas o canceladas')
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remisión</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {isWashingStaff ? 'Usuario' : 'Personal'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Canastillas</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {historial.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {order.remision_entrega_number}
                              </div>
                              {order.remision_devolucion_number && (
                                <div className="text-xs text-gray-500">
                                  Dev: {order.remision_devolucion_number}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {isWashingStaff
                                  ? `${order.sender_user?.first_name} ${order.sender_user?.last_name}`
                                  : `${order.washing_staff?.first_name} ${order.washing_staff?.last_name}`
                                }
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {order.washing_items?.length || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {new Date(order.updated_at).toLocaleDateString('es-CO')}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                                order.status === 'CONFIRMADO'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {order.status === 'CONFIRMADO' ? 'Completado' : 'Cancelado'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => openModal('detalle', order)}
                                className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                              >
                                Ver Detalle
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Modales */}
      <EnviarLavadoModal
        isOpen={showEnviarModal}
        onClose={() => setShowEnviarModal(false)}
        onSuccess={refreshLavado}
      />

      <RecibirLavadoModal
        isOpen={showRecibirModal}
        order={selectedOrder}
        onClose={() => {
          setShowRecibirModal(false)
          setSelectedOrder(null)
        }}
        onSuccess={refreshLavado}
      />

      <MarcarLavadoModal
        isOpen={showMarcarModal}
        order={selectedOrder}
        onClose={() => {
          setShowMarcarModal(false)
          setSelectedOrder(null)
        }}
        onSuccess={refreshLavado}
      />

      <EntregarLavadoModal
        isOpen={showEntregarModal}
        order={selectedOrder}
        onClose={() => {
          setShowEntregarModal(false)
          setSelectedOrder(null)
        }}
        onSuccess={refreshLavado}
      />

      <ConfirmarRecepcionLavadoModal
        isOpen={showConfirmarModal}
        order={selectedOrder}
        onClose={() => {
          setShowConfirmarModal(false)
          setSelectedOrder(null)
        }}
        onSuccess={refreshLavado}
      />

      <DetalleLavadoModal
        isOpen={showDetalleModal}
        order={selectedOrder}
        onClose={() => {
          setShowDetalleModal(false)
          setSelectedOrder(null)
        }}
      />
    </DashboardLayout>
  )
}
