import { useState } from 'react'
import { Button } from './Button'
import { deliverOrder } from '@/services/washingService'
import type { WashingOrder } from '@/types'

interface EntregarLavadoModalProps {
  isOpen: boolean
  order: WashingOrder | null
  onClose: () => void
  onSuccess: () => void
}

export function EntregarLavadoModal({
  isOpen,
  order,
  onClose,
  onSuccess,
}: EntregarLavadoModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!order) return

    setError('')
    setLoading(true)

    try {
      const remisionDevolucion = await deliverOrder(order.id)
      alert(`Canastillas entregadas correctamente.\nRemisión de devolución: ${remisionDevolucion}`)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error delivering order:', err)
      setError(err.message || 'Error al entregar las canastillas')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !order) return null

  const totalCanastillas = order.washing_items?.length || 0
  const lavadas = order.washing_items?.filter(i => i.item_status === 'LAVADA').length || 0
  const danadas = order.washing_items?.filter(i => i.item_status === 'DANADA').length || 0

  // Calcular tiempo de lavado
  const tiempoLavado = order.received_at && order.washed_at
    ? Math.round((new Date(order.washed_at).getTime() - new Date(order.received_at).getTime()) / (1000 * 60 * 60))
    : 0

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
          <div className="bg-orange-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Entregar Canastillas Lavadas
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
              <h4 className="font-medium text-gray-900 mb-3">Resumen del Lavado</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Remisión entrada:</span>
                  <p className="font-medium">{order.remision_entrega_number}</p>
                </div>
                <div>
                  <span className="text-gray-500">Destinatario:</span>
                  <p className="font-medium">
                    {order.sender_user?.first_name} {order.sender_user?.last_name}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Total canastillas:</span>
                  <p className="font-medium">{totalCanastillas}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tiempo de lavado:</span>
                  <p className="font-medium">{tiempoLavado} hora{tiempoLavado !== 1 ? 's' : ''}</p>
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
                  <p className="text-sm text-red-700">Dañadas</p>
                </div>
              )}
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-orange-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">Al confirmar la entrega:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Se generará la remisión de devolución</li>
                    <li>El usuario deberá confirmar la recepción</li>
                    <li>Las canastillas volverán a estar disponibles después de la confirmación</li>
                  </ul>
                </div>
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
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? 'Procesando...' : 'Confirmar Entrega'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
