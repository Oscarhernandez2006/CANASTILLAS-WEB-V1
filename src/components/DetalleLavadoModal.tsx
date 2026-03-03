import { Button } from './Button'
import { calculateOrderTimes } from '@/services/washingService'
import type { WashingOrder } from '@/types'

interface DetalleLavadoModalProps {
  isOpen: boolean
  order: WashingOrder | null
  onClose: () => void
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  ENVIADO: { label: 'Enviado', color: 'text-blue-700', bg: 'bg-blue-100' },
  RECIBIDO: { label: 'En Proceso', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  LAVADO_COMPLETADO: { label: 'Lavado Completado', color: 'text-purple-700', bg: 'bg-purple-100' },
  ENTREGADO: { label: 'Entregado', color: 'text-orange-700', bg: 'bg-orange-100' },
  CONFIRMADO: { label: 'Confirmado', color: 'text-green-700', bg: 'bg-green-100' },
  CANCELADO: { label: 'Cancelado', color: 'text-red-700', bg: 'bg-red-100' },
}

export function DetalleLavadoModal({
  isOpen,
  order,
  onClose,
}: DetalleLavadoModalProps) {
  if (!isOpen || !order) return null

  const status = statusConfig[order.status] || statusConfig.ENVIADO
  const times = calculateOrderTimes(order)
  const totalCanastillas = order.washing_items?.length || 0
  const lavadas = order.washing_items?.filter(i => i.item_status === 'LAVADA').length || 0
  const danadas = order.washing_items?.filter(i => i.item_status === 'DANADA').length || 0

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Detalle de Orden de Lavado
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

          <div className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Estado y remisiones */}
            <div className="flex items-center justify-between">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${status.bg} ${status.color}`}>
                {status.label}
              </span>
              <div className="text-right text-sm">
                <p className="text-gray-500">Remisión Entrega: <span className="font-medium text-gray-900">{order.remision_entrega_number}</span></p>
                {order.remision_devolucion_number && (
                  <p className="text-gray-500">Remisión Devolución: <span className="font-medium text-gray-900">{order.remision_devolucion_number}</span></p>
                )}
              </div>
            </div>

            {/* Información de usuarios */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Enviado por</h4>
                <p className="font-medium text-gray-900">
                  {order.sender_user?.first_name} {order.sender_user?.last_name}
                </p>
                <p className="text-sm text-gray-500">{order.sender_user?.email}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Lavado por</h4>
                {order.washing_staff ? (
                  <>
                    <p className="font-medium text-gray-900">
                      {order.washing_staff.first_name} {order.washing_staff.last_name}
                    </p>
                    <p className="text-sm text-gray-500">{order.washing_staff.email}</p>
                  </>
                ) : (
                  <p className="text-gray-400">Pendiente de asignar</p>
                )}
              </div>
            </div>

            {/* Resumen de canastillas */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{totalCanastillas}</p>
                <p className="text-sm text-blue-700">Total</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{lavadas}</p>
                <p className="text-sm text-green-700">Lavadas</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{danadas}</p>
                <p className="text-sm text-red-700">Dañadas</p>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Timeline del Proceso</h4>
              <div className="space-y-4">
                <TimelineItem
                  completed={true}
                  label="Enviado"
                  date={order.sent_at}
                  duration={times.waitingTime !== undefined ? `${times.waitingTime}h en espera` : undefined}
                />
                <TimelineItem
                  completed={!!order.received_at}
                  label="Recibido"
                  date={order.received_at}
                  duration={times.washingTime !== undefined ? `${times.washingTime}h de lavado` : undefined}
                />
                <TimelineItem
                  completed={!!order.washed_at}
                  label="Lavado Completado"
                  date={order.washed_at}
                  duration={times.deliveryTime !== undefined ? `${times.deliveryTime}h para entrega` : undefined}
                />
                <TimelineItem
                  completed={!!order.delivered_at}
                  label="Entregado"
                  date={order.delivered_at}
                />
                <TimelineItem
                  completed={!!order.confirmed_at}
                  label="Confirmado"
                  date={order.confirmed_at}
                  isLast
                />
              </div>
              {times.totalTime !== undefined && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Tiempo total del proceso: <span className="font-medium text-gray-900">{times.totalTime} horas</span>
                  </p>
                </div>
              )}
            </div>

            {/* Lista de canastillas */}
            {order.washing_items && order.washing_items.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Canastillas ({totalCanastillas})</h4>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tamaño</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {order.washing_items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {item.canastilla?.codigo}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {item.canastilla?.size}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {item.canastilla?.color}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.item_status === 'LAVADA' ? 'bg-green-100 text-green-700' :
                              item.item_status === 'DANADA' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {item.item_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notas */}
            {order.notes && (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                <h4 className="text-sm font-medium text-amber-800 mb-1">Notas</h4>
                <p className="text-sm text-amber-700">{order.notes}</p>
              </div>
            )}

            {/* Razón de cancelación */}
            {order.status === 'CANCELADO' && order.cancellation_reason && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                <h4 className="text-sm font-medium text-red-800 mb-1">Razón de cancelación</h4>
                <p className="text-sm text-red-700">{order.cancellation_reason}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-6 py-4 flex items-center justify-end">
            <Button onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineItem({
  completed,
  label,
  date,
  duration,
  isLast = false,
}: {
  completed: boolean
  label: string
  date?: string
  duration?: string
  isLast?: boolean
}) {
  return (
    <div className="flex items-start">
      <div className="flex flex-col items-center">
        <div className={`w-4 h-4 rounded-full ${completed ? 'bg-green-500' : 'bg-gray-300'}`} />
        {!isLast && <div className={`w-0.5 h-8 ${completed ? 'bg-green-500' : 'bg-gray-300'}`} />}
      </div>
      <div className="ml-4 -mt-1">
        <p className={`font-medium ${completed ? 'text-gray-900' : 'text-gray-400'}`}>{label}</p>
        {date && (
          <p className="text-sm text-gray-500">
            {new Date(date).toLocaleString('es-CO')}
          </p>
        )}
        {duration && (
          <p className="text-xs text-blue-600">{duration}</p>
        )}
      </div>
    </div>
  )
}
