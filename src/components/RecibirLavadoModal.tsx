import { useState } from 'react'
import { Button } from './Button'
import { receiveOrder } from '@/services/washingService'
import { useAuthStore } from '@/store/authStore'
import type { WashingOrder } from '@/types'

interface RecibirLavadoModalProps {
  isOpen: boolean
  order: WashingOrder | null
  onClose: () => void
  onSuccess: () => void
}

export function RecibirLavadoModal({
  isOpen,
  order,
  onClose,
  onSuccess,
}: RecibirLavadoModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuthStore()

  const handleSubmit = async () => {
    if (!order || !user) return

    setError('')
    setLoading(true)

    try {
      await receiveOrder(order.id, user.id)
      alert('Canastillas recibidas correctamente')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error receiving order:', err)
      setError(err.message || 'Error al recibir las canastillas')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !order) return null

  const totalCanastillas = order.washing_items?.length || 0

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
          <div className="bg-green-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Confirmar Recepción
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
              <h4 className="font-medium text-gray-900 mb-3">Detalles de la Orden</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Remisión:</span>
                  <span className="font-medium">{order.remision_entrega_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Enviado por:</span>
                  <span className="font-medium">
                    {order.sender_user?.first_name} {order.sender_user?.last_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha de envío:</span>
                  <span className="font-medium">
                    {new Date(order.sent_at).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total canastillas:</span>
                  <span className="font-medium">{totalCanastillas}</span>
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                <p className="text-sm text-amber-800">
                  <strong>Notas:</strong> {order.notes}
                </p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-blue-800">
                  Al confirmar la recepción, las canastillas pasarán a estado "En Proceso" y podrás comenzar el lavado.
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
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Procesando...' : 'Confirmar Recepción'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
