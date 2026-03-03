import { useState } from 'react'
import { Button } from './Button'
import { confirmReception, calculateOrderTimes } from '@/services/washingService'
import type { WashingOrder } from '@/types'

interface ConfirmarRecepcionLavadoModalProps {
  isOpen: boolean
  order: WashingOrder | null
  onClose: () => void
  onSuccess: () => void
}

export function ConfirmarRecepcionLavadoModal({
  isOpen,
  order,
  onClose,
  onSuccess,
}: ConfirmarRecepcionLavadoModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!order) return

    setError('')
    setLoading(true)

    try {
      await confirmReception(order.id)
      alert('Recepción confirmada. Las canastillas ya están disponibles en tu inventario.')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error confirming reception:', err)
      setError(err.message || 'Error al confirmar la recepción')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !order) return null

  const totalCanastillas = order.washing_items?.length || 0
  const lavadas = order.washing_items?.filter(i => i.item_status === 'LAVADA').length || 0
  const danadas = order.washing_items?.filter(i => i.item_status === 'DANADA').length || 0

  // Calcular tiempos
  const times = calculateOrderTimes(order)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-teal-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Confirmar Recepción de Lavado
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-white hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-6 py-6 space-y-4">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Detalles del Lavado</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Remisión entrada:</span>
                  <p className="font-medium">{order.remision_entrega_number}</p>
                </div>
                <div>
                  <span className="text-gray-500">Remisión devolución:</span>
                  <p className="font-medium">{order.remision_devolucion_number}</p>
                </div>
                <div>
                  <span className="text-gray-500">Lavado por:</span>
                  <p className="font-medium">
                    {order.washing_staff?.first_name} {order.washing_staff?.last_name}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Total canastillas:</span>
                  <p className="font-medium">{totalCanastillas}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{lavadas}</p>
                <p className="text-sm text-green-700">Lavadas</p>
              </div>
              {danadas > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{danadas}</p>
                  <p className="text-sm text-red-700">Reportadas como dañadas</p>
                </div>
              )}
            </div>

            {/* Timeline de tiempos */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Tiempos del Proceso</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Enviado:</span>
                  <span className="font-medium">
                    {new Date(order.sent_at).toLocaleString('es-CO')}
                  </span>
                </div>
                {order.received_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Recibido por lavado:</span>
                    <span className="font-medium">
                      {new Date(order.received_at).toLocaleString('es-CO')}
                      {times.waitingTime !== undefined && (
                        <span className="text-blue-600 ml-2">
                          ({times.waitingTime}h espera)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {order.washed_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Lavado completado:</span>
                    <span className="font-medium">
                      {new Date(order.washed_at).toLocaleString('es-CO')}
                      {times.washingTime !== undefined && (
                        <span className="text-purple-600 ml-2">
                          ({times.washingTime}h lavado)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {order.delivered_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Entregado:</span>
                    <span className="font-medium">
                      {new Date(order.delivered_at).toLocaleString('es-CO')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-teal-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-teal-800">
                  Al confirmar la recepción, las canastillas pasarán a estado "Disponible" y podrás usarlas nuevamente.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              loading={loading}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? 'Procesando...' : 'Confirmar Recepción'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
