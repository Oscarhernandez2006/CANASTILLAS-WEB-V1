import type { WashingOrder } from '@/types'

interface LavadoCardProps {
  order: WashingOrder
  showSender?: boolean
  showStaff?: boolean
  onView?: () => void
  onAction?: () => void
  actionLabel?: string
  actionColor?: string
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ENVIADO: { label: 'Enviado', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  RECIBIDO: { label: 'En Proceso', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  LAVADO_COMPLETADO: { label: 'Listo', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  ENTREGADO: { label: 'Entregado', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  CONFIRMADO: { label: 'Confirmado', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  CANCELADO: { label: 'Cancelado', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
}

export function LavadoCard({
  order,
  showSender = false,
  showStaff = false,
  onView,
  onAction,
  actionLabel,
  actionColor = 'bg-primary-600 hover:bg-primary-700',
}: LavadoCardProps) {
  const status = statusConfig[order.status] || statusConfig.ENVIADO
  const totalCanastillas = order.washing_items?.length || 0

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className={`bg-white rounded-xl border ${status.border} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Remisión</p>
            <p className="font-semibold text-gray-900">{order.remision_entrega_number}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Usuario */}
        {showSender && order.sender_user && (
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {order.sender_user.first_name?.charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {order.sender_user.first_name} {order.sender_user.last_name}
              </p>
              <p className="text-xs text-gray-500">Enviado por</p>
            </div>
          </div>
        )}

        {showStaff && order.washing_staff && (
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {order.washing_staff.first_name?.charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {order.washing_staff.first_name} {order.washing_staff.last_name}
              </p>
              <p className="text-xs text-gray-500">Personal de lavado</p>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <p className="text-gray-500 text-xs">Canastillas</p>
            <p className="font-medium text-gray-900">{totalCanastillas}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Fecha envío</p>
            <p className="font-medium text-gray-900">{formatDate(order.sent_at)}</p>
          </div>
        </div>

        {/* Notas */}
        {order.notes && (
          <div className="mb-4 p-2 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 line-clamp-2">{order.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2">
          {onView && (
            <button
              onClick={onView}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Ver Detalle
            </button>
          )}
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              className={`flex-1 px-3 py-2 text-sm font-medium text-white rounded-lg transition-colors ${actionColor}`}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
