import { formatDate } from '@/utils/helpers'
import { Button } from './Button'

interface Transfer {
  id: string
  from_user_id: string
  to_user_id: string
  status: string
  reason: string
  notes: string | null
  response_notes: string | null
  requested_at: string
  responded_at: string | null
  from_user: {
    first_name: string
    last_name: string
    email: string
  }
  to_user: {
    first_name: string
    last_name: string
    email: string
  }
  transfer_items: Array<{
    canastilla: {
      id: string
      codigo: string
      qr_code: string
      size: string
      color: string
    }
  }>
}

interface TransferCardProps {
  transfer: Transfer
  type: 'enviado' | 'recibido' | 'historial'
  currentUserId: string
  onApprove?: (transfer: Transfer) => void
  onReject?: (transfer: Transfer) => void
  onCancel?: (transfer: Transfer) => void
}

export function TransferCard({ 
  transfer, 
  type, 
  currentUserId,
  onApprove, 
  onReject,
  onCancel 
}: TransferCardProps) {
  const isFromMe = transfer.from_user_id === currentUserId
  const isPending = transfer.status === 'PENDIENTE'

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDIENTE: 'bg-yellow-100 text-yellow-800',
      ACEPTADO: 'bg-green-100 text-green-800',
      RECHAZADO: 'bg-red-100 text-red-800',
      CANCELADO: 'bg-gray-100 text-gray-800',
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const labels = {
      PENDIENTE: 'Pendiente',
      ACEPTADO: 'Aceptado',
      RECHAZADO: 'Rechazado',
      CANCELADO: 'Cancelado',
    }
    return labels[status as keyof typeof labels] || status
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {isFromMe ? 'Para: ' : 'De: '}
              {isFromMe 
                ? `${transfer.to_user.first_name} ${transfer.to_user.last_name}`
                : `${transfer.from_user.first_name} ${transfer.from_user.last_name}`
              }
            </h3>
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(transfer.status)}`}>
              {getStatusLabel(transfer.status)}
            </span>
          </div>
          <p className="text-sm text-gray-600">{transfer.reason}</p>
        </div>
      </div>

      {/* Canastillas */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Canastillas ({transfer.transfer_items.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {transfer.transfer_items.slice(0, 6).map((item, index) => (
            <span 
              key={index}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded"
            >
              {item.canastilla.codigo}
            </span>
          ))}
          {transfer.transfer_items.length > 6 && (
            <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-medium rounded">
              +{transfer.transfer_items.length - 6} más
            </span>
          )}
        </div>
      </div>

      {/* Notas */}
      {transfer.notes && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs font-medium text-blue-900 mb-1">Notas:</p>
          <p className="text-sm text-blue-800">{transfer.notes}</p>
        </div>
      )}

      {/* Respuesta */}
      {transfer.response_notes && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-900 mb-1">Respuesta:</p>
          <p className="text-sm text-gray-700">{transfer.response_notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <p>Solicitado: {formatDate(transfer.requested_at)}</p>
          {transfer.responded_at && (
            <p>Respondido: {formatDate(transfer.responded_at)}</p>
          )}
        </div>

        {/* Acciones */}
        {isPending && type === 'recibido' && (
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject?.(transfer)}
            >
              Rechazar
            </Button>
            <Button
              size="sm"
              onClick={() => onApprove?.(transfer)}
            >
              Aceptar
            </Button>
          </div>
        )}

        {isPending && type === 'enviado' && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => onCancel?.(transfer)}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}