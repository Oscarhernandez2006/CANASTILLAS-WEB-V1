import { useState } from 'react'
import { Button } from './Button'
import { markWashingCompleted } from '@/services/washingService'
import type { WashingOrder, WashingItemStatus } from '@/types'

interface ItemUpdate {
  itemId: string
  canastillaCode: string
  status: WashingItemStatus
  notes: string
}

interface MarcarLavadoModalProps {
  isOpen: boolean
  order: WashingOrder | null
  onClose: () => void
  onSuccess: () => void
}

export function MarcarLavadoModal({
  isOpen,
  order,
  onClose,
  onSuccess,
}: MarcarLavadoModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [itemUpdates, setItemUpdates] = useState<ItemUpdate[]>([])
  const [markAllAsWashed, setMarkAllAsWashed] = useState(true)

  // Inicializar items cuando se abre el modal
  useState(() => {
    if (order?.washing_items) {
      setItemUpdates(
        order.washing_items.map(item => ({
          itemId: item.id,
          canastillaCode: item.canastilla?.codigo || '',
          status: 'LAVADA' as WashingItemStatus,
          notes: '',
        }))
      )
    }
  })

  const handleSubmit = async () => {
    if (!order) return

    setError('')
    setLoading(true)

    try {
      if (markAllAsWashed) {
        // Marcar todas como lavadas sin detalles específicos
        await markWashingCompleted(order.id)
      } else {
        // Enviar actualizaciones individuales
        const updates = itemUpdates.map(item => ({
          itemId: item.itemId,
          status: item.status,
          notes: item.notes || undefined,
        }))
        await markWashingCompleted(order.id, updates)
      }

      alert('Lavado marcado como completado')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error marking completed:', err)
      setError(err.message || 'Error al marcar el lavado como completado')
    } finally {
      setLoading(false)
    }
  }

  const updateItemStatus = (itemId: string, status: WashingItemStatus) => {
    setItemUpdates(prev =>
      prev.map(item =>
        item.itemId === itemId ? { ...item, status } : item
      )
    )
  }

  const updateItemNotes = (itemId: string, notes: string) => {
    setItemUpdates(prev =>
      prev.map(item =>
        item.itemId === itemId ? { ...item, notes } : item
      )
    )
  }

  if (!isOpen || !order) return null

  const totalCanastillas = order.washing_items?.length || 0
  const tiempoEnProceso = order.received_at
    ? Math.round((new Date().getTime() - new Date(order.received_at).getTime()) / (1000 * 60 * 60))
    : 0

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Marcar Lavado Completado
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

          <div className="px-6 py-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Resumen de la Orden</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Remisión:</span>
                  <p className="font-medium">{order.remision_entrega_number}</p>
                </div>
                <div>
                  <span className="text-gray-500">Canastillas:</span>
                  <p className="font-medium">{totalCanastillas}</p>
                </div>
                <div>
                  <span className="text-gray-500">Recibido:</span>
                  <p className="font-medium">
                    {order.received_at ? new Date(order.received_at).toLocaleString('es-CO') : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Tiempo en proceso:</span>
                  <p className="font-medium">{tiempoEnProceso} hora{tiempoEnProceso !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markAllAsWashed}
                  onChange={(e) => setMarkAllAsWashed(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">
                  Marcar todas las canastillas como lavadas
                </span>
              </label>
            </div>

            {!markAllAsWashed && order.washing_items && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Estado de cada canastilla:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {order.washing_items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-sm min-w-[80px]">
                        {item.canastilla?.codigo}
                      </span>
                      <select
                        value={itemUpdates.find(u => u.itemId === item.id)?.status || 'LAVADA'}
                        onChange={(e) => updateItemStatus(item.id, e.target.value as WashingItemStatus)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500"
                      >
                        <option value="LAVADA">Lavada</option>
                        <option value="DANADA">Dañada</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Notas..."
                        value={itemUpdates.find(u => u.itemId === item.id)?.notes || ''}
                        onChange={(e) => updateItemNotes(item.id, e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-purple-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-purple-800">
                  Al marcar como completado, la orden pasará a estado "Listo para Entregar" y podrás proceder con la entrega.
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
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? 'Procesando...' : 'Marcar Completado'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
