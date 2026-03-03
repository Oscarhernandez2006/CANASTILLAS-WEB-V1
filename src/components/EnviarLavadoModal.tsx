import { useState, useEffect } from 'react'
import { Button } from './Button'
import { CanastillaLoteSelector } from './CanastillaLoteSelector'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { createWashingOrder, getWashingStaff, getAvailableCanastillasForWashing } from '@/services/washingService'
import type { User, Canastilla } from '@/types'

interface LoteItem {
  id: string
  size: string
  color: string
  ubicacion: string
  cantidad: number
  canastillaIds: string[]
}

interface EnviarLavadoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EnviarLavadoModal({
  isOpen,
  onClose,
  onSuccess,
}: EnviarLavadoModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [washingStaff, setWashingStaff] = useState<User[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const { user: currentUser } = useAuthStore()

  const [canastillasDisponibles, setCanastillasDisponibles] = useState<Canastilla[]>([])
  const [selectedCanastillas, setSelectedCanastillas] = useState<Set<string>>(new Set())
  const [lotes, setLotes] = useState<LoteItem[]>([])
  const [canastillasRetenidas, setCanastillasRetenidas] = useState(0)

  const [formData, setFormData] = useState({
    washing_staff_id: '',
    notes: '',
  })

  useEffect(() => {
    if (isOpen) {
      fetchWashingStaff()
      fetchCanastillasDisponibles()
    }
  }, [isOpen])

  const fetchCanastillasDisponibles = async () => {
    try {
      if (!currentUser) return

      // 1. Obtener IDs de canastillas que ya están en traspasos PENDIENTES
      const { data: traspasosPendientes } = await supabase
        .from('transfers')
        .select('id')
        .eq('from_user_id', currentUser.id)
        .eq('status', 'PENDIENTE')

      let canastillasEnTraspaso: string[] = []

      if (traspasosPendientes && traspasosPendientes.length > 0) {
        const transferIds = traspasosPendientes.map(t => t.id)
        const { data: itemsRetenidos } = await supabase
          .from('transfer_items')
          .select('canastilla_id')
          .in('transfer_id', transferIds)

        if (itemsRetenidos) {
          canastillasEnTraspaso = itemsRetenidos.map(item => item.canastilla_id)
        }
      }

      // 2. Obtener IDs de canastillas que ya están en órdenes de lavado activas
      const { data: lavadosPendientes } = await supabase
        .from('washing_orders')
        .select('id')
        .eq('sender_user_id', currentUser.id)
        .in('status', ['ENVIADO', 'RECIBIDO', 'LAVADO_COMPLETADO', 'ENTREGADO'])

      let canastillasEnLavado: string[] = []

      if (lavadosPendientes && lavadosPendientes.length > 0) {
        const washingIds = lavadosPendientes.map(w => w.id)
        const { data: itemsLavado } = await supabase
          .from('washing_order_items')
          .select('canastilla_id')
          .in('washing_order_id', washingIds)

        if (itemsLavado) {
          canastillasEnLavado = itemsLavado.map(item => item.canastilla_id)
        }
      }

      // 3. Obtener canastillas disponibles del usuario con paginación
      const PAGE_SIZE = 1000
      let disponibles: Canastilla[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error: errorDisponibles } = await supabase
          .from('canastillas')
          .select('*')
          .eq('current_owner_id', currentUser.id)
          .eq('status', 'DISPONIBLE')
          .order('codigo')
          .range(offset, offset + PAGE_SIZE - 1)

        if (errorDisponibles) throw errorDisponibles

        if (data && data.length > 0) {
          disponibles = [...disponibles, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      // 4. Filtrar canastillas retenidas
      const todasRetenidas = [...canastillasEnTraspaso, ...canastillasEnLavado]
      const canastillasLibres = disponibles.filter(
        c => !todasRetenidas.includes(c.id)
      )

      const cantidadRetenidas = (disponibles || []).length - canastillasLibres.length
      setCanastillasRetenidas(cantidadRetenidas)
      setCanastillasDisponibles(canastillasLibres)
    } catch (error) {
      console.error('Error fetching canastillas:', error)
      setCanastillasDisponibles([])
    }
  }

  const handleLotesChange = (nuevosLotes: LoteItem[]) => {
    setLotes(nuevosLotes)
    const allIds = nuevosLotes.flatMap(lote => lote.canastillaIds)
    setSelectedCanastillas(new Set(allIds))
  }

  const fetchWashingStaff = async () => {
    try {
      setLoadingStaff(true)
      const staff = await getWashingStaff()
      setWashingStaff(staff)
    } catch (error: any) {
      console.error('Error fetching washing staff:', error)
      setError('Error al cargar personal de lavado')
      setWashingStaff([])
    } finally {
      setLoadingStaff(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!currentUser) throw new Error('Usuario no autenticado')
      if (!formData.washing_staff_id) throw new Error('Selecciona un personal de lavado')
      if (selectedCanastillas.size === 0) throw new Error('Selecciona al menos una canastilla')

      const canastillaIds = Array.from(selectedCanastillas)

      // Crear la orden de lavado
      const order = await createWashingOrder(
        currentUser.id,
        formData.washing_staff_id,
        canastillaIds,
        formData.notes || undefined
      )

      // Crear notificación para el personal de lavado
      await supabase
        .from('notifications')
        .insert([{
          user_id: formData.washing_staff_id,
          type: 'LAVADO_RECIBIDO',
          title: 'Nueva orden de lavado',
          message: `${currentUser.first_name} ${currentUser.last_name} te ha enviado ${canastillaIds.length} canastilla${canastillaIds.length !== 1 ? 's' : ''} para lavar.`,
          related_id: order.id
        }])

      alert(`Orden de lavado creada exitosamente. Remisión: ${order.remision_entrega_number}`)
      onSuccess()
      handleClose()
    } catch (err: any) {
      console.error('Submit error:', err)
      setError(err.message || 'Error al crear la orden de lavado')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({ washing_staff_id: '', notes: '' })
    setSelectedCanastillas(new Set())
    setLotes([])
    setError('')
    setCanastillasRetenidas(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        />

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            <div className="bg-blue-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    Enviar a Lavado
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-white hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {canastillasRetenidas > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-700 px-4 py-3 rounded-r-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm">
                      <strong>{canastillasRetenidas}</strong> canastilla{canastillasRetenidas !== 1 ? 's' : ''} no disponible{canastillasRetenidas !== 1 ? 's' : ''} porque ya está{canastillasRetenidas !== 1 ? 'n' : ''} en procesos de traspaso o lavado pendientes.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Seleccionar Canastillas para Lavar
                </label>
                <CanastillaLoteSelector
                  canastillasDisponibles={canastillasDisponibles}
                  onLotesChange={handleLotesChange}
                  selectedIds={selectedCanastillas}
                />
              </div>

              {selectedCanastillas.size > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Total seleccionado: <strong>{selectedCanastillas.size}</strong> canastilla{selectedCanastillas.size !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal de Lavado *
                </label>
                {loadingStaff ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    <span className="ml-2 text-sm text-gray-600">Cargando personal...</span>
                  </div>
                ) : (
                  <>
                    <select
                      value={formData.washing_staff_id}
                      onChange={(e) => setFormData({ ...formData, washing_staff_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleccionar personal...</option>
                      {washingStaff.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.first_name} {staff.last_name}
                        </option>
                      ))}
                    </select>
                    {washingStaff.length === 0 && (
                      <p className="mt-2 text-sm text-red-600">
                        No hay personal de lavado disponible
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas Adicionales
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Instrucciones especiales para el lavado..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={loading || washingStaff.length === 0 || selectedCanastillas.size === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Enviando...' : 'Enviar a Lavado'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
