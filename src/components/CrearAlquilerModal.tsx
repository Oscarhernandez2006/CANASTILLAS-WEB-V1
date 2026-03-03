import { useState, useEffect } from 'react'
import { Button } from './Button'
import { CanastillaLoteSelector } from './CanastillaLoteSelector'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useSalePoints } from '@/hooks/useSalePoints'
import { useRentalSettings } from '@/hooks/useRentalSettings'
import type { Canastilla } from '@/types'
import { formatCurrency } from '@/utils/helpers'

interface LoteItem {
  id: string
  size: string
  color: string
  ubicacion: string
  cantidad: number
  canastillaIds: string[]
}

interface CrearAlquilerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CrearAlquilerModal({ isOpen, onClose, onSuccess }: CrearAlquilerModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  
  const { user } = useAuthStore()
  const { salePoints, loading: loadingSalePoints } = useSalePoints()
  const { settings } = useRentalSettings()
  
  const [canastillasDisponibles, setCanastillasDisponibles] = useState<Canastilla[]>([])
  const [selectedCanastillas, setSelectedCanastillas] = useState<Set<string>>(new Set())
  const [lotes, setLotes] = useState<LoteItem[]>([])
  
  const [formData, setFormData] = useState({
    sale_point_id: '',
    rental_type: 'EXTERNO' as 'INTERNO' | 'EXTERNO',
    estimated_return_date: '',
  })

  useEffect(() => {
    if (isOpen && step === 2) {
      fetchCanastillasDisponibles()
    }
  }, [isOpen, step])

  const fetchCanastillasDisponibles = async () => {
    try {
      if (!user) return

      // Cargar TODAS las canastillas disponibles usando paginación interna
      const PAGE_SIZE = 1000
      let allCanastillas: Canastilla[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error } = await supabase
          .from('canastillas')
          .select('*')
          .eq('current_owner_id', user.id)
          .eq('status', 'DISPONIBLE')
          .order('codigo')
          .range(offset, offset + PAGE_SIZE - 1)

        if (error) throw error

        if (data && data.length > 0) {
          allCanastillas = [...allCanastillas, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      setCanastillasDisponibles(allCanastillas)
    } catch (error) {
      console.error('Error fetching canastillas:', error)
      setCanastillasDisponibles([])
    }
  }


  const handleNextStep = () => {
    if (!formData.sale_point_id) {
      setError('Selecciona un cliente o punto de venta')
      return
    }
    setError('')
    setStep(2)
  }

  const handleLotesChange = (nuevosLotes: LoteItem[]) => {
    setLotes(nuevosLotes)
    // Actualizar el Set de IDs seleccionados con todos los IDs de los lotes
    const allIds = nuevosLotes.flatMap(lote => lote.canastillaIds)
    setSelectedCanastillas(new Set(allIds))
  }

  const handleSubmit = async () => {
    if (selectedCanastillas.size === 0) {
      setError('Selecciona al menos una canastilla')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (!user) throw new Error('Usuario no autenticado')

      const canastillaIds = Array.from(selectedCanastillas)
      // Tarifa según tipo: INTERNO = tarifa fija, EXTERNO = tarifa por día
      const dailyRate = formData.rental_type === 'INTERNO'
        ? (settings?.internal_rate || 1)
        : (settings?.daily_rate || 2)

      // 1. Generar número de remisión
      const { data: remisionData, error: remisionError } = await supabase.rpc('generate_remision_number')
      
      if (remisionError) throw remisionError
      const remisionNumber = remisionData

      // 2. Calcular días estimados si hay fecha de retorno
      let estimatedDays = 0
      if (formData.estimated_return_date) {
        const start = new Date(new Date().toDateString())
        const end = new Date(new Date(formData.estimated_return_date).toDateString())
        estimatedDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
      }

      // 3. Crear el alquiler con número de remisión e inicializar contadores
      const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .insert([{
          sale_point_id: formData.sale_point_id,
          rental_type: formData.rental_type,
          status: 'ACTIVO',
          start_date: new Date().toISOString(),
          estimated_return_date: formData.estimated_return_date || null,
          estimated_days: estimatedDays,
          daily_rate: dailyRate,
          created_by: user.id,
          remision_number: remisionNumber,
          remision_generated_at: new Date().toISOString(),
          // Inicializar contadores para devoluciones parciales
          pending_items_count: canastillaIds.length,
          returned_items_count: 0,
          total_invoiced: 0,
        }])
        .select()
        .single()

      if (rentalError) throw rentalError

      // 4. Insertar las canastillas del alquiler (en lotes de 500)
      const rentalItems = canastillaIds.map(canastillaId => ({
        rental_id: rental.id,
        canastilla_id: canastillaId
      }))

      const BATCH_SIZE = 500
      for (let i = 0; i < rentalItems.length; i += BATCH_SIZE) {
        const batch = rentalItems.slice(i, i + BATCH_SIZE)
        const { error: itemsError } = await supabase
          .from('rental_items')
          .insert(batch)

        if (itemsError) throw itemsError
      }

      // 5. Actualizar estado de las canastillas (en lotes de 500)
      for (let i = 0; i < canastillaIds.length; i += BATCH_SIZE) {
        const batch = canastillaIds.slice(i, i + BATCH_SIZE)
        const { error: updateError } = await supabase
          .from('canastillas')
          .update({ status: 'EN_ALQUILER' })
          .in('id', batch)

        if (updateError) throw updateError
      }

      // 6. Obtener el alquiler base sin items (para evitar límite de 1000)
      const { data: rentalBase, error: fetchError } = await supabase
        .from('rentals')
        .select(`
          *,
          sale_point:sale_points(*)
        `)
        .eq('id', rental.id)
        .single()

      if (fetchError) throw fetchError

      // Obtener TODOS los rental_items con paginación
      const PAGE_SIZE_ITEMS = 1000
      let allRentalItems: any[] = []
      let hasMoreItems = true
      let offsetItems = 0

      while (hasMoreItems) {
        const { data: itemsBatch, error: itemsFetchError } = await supabase
          .from('rental_items')
          .select('*, canastilla:canastillas(*)')
          .eq('rental_id', rental.id)
          .range(offsetItems, offsetItems + PAGE_SIZE_ITEMS - 1)

        if (itemsFetchError) throw itemsFetchError

        if (itemsBatch && itemsBatch.length > 0) {
          allRentalItems = [...allRentalItems, ...itemsBatch]
          offsetItems += PAGE_SIZE_ITEMS
          hasMoreItems = itemsBatch.length === PAGE_SIZE_ITEMS
        } else {
          hasMoreItems = false
        }
      }

      // Combinar rental con todos sus items
      const rentalComplete = {
        ...rentalBase,
        rental_items: allRentalItems
      }

      // 7. Generar y abrir PDF de remisión automáticamente
      const { openRemisionPDF } = await import('@/utils/remisionGenerator')
      await openRemisionPDF(rentalComplete, remisionNumber)

      alert(`✅ Alquiler creado exitosamente\n📄 Remisión: ${remisionNumber}\n\nEl documento de remisión se ha generado automáticamente.`)
      
      onSuccess()
      handleClose()
    } catch (err: any) {
      console.error('Error creating rental:', err)
      setError(err.message || 'Error al crear el alquiler')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setFormData({ sale_point_id: '', rental_type: 'EXTERNO', estimated_return_date: '' })
    setSelectedCanastillas(new Set())
    setLotes([])
    setError('')
    onClose()
  }

  if (!isOpen) return null

  // Calcular total estimado según tipo de alquiler
  const getDaysCount = () => {
    if (!formData.estimated_return_date) return 0
    const start = new Date(new Date().toDateString())
    const end = new Date(new Date(formData.estimated_return_date).toDateString())
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const totalEstimado = formData.rental_type === 'INTERNO'
    ? selectedCanastillas.size * (settings?.internal_rate || 1)  // INTERNO: tarifa fija por canastilla
    : (selectedCanastillas.size * (settings?.daily_rate || 2)) * getDaysCount()  // EXTERNO: (canastillas × precio) × días

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        ></div>

        {/* Modal */}
        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-[calc(100%-2rem)] sm:max-w-4xl mx-4 sm:mx-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary-600 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                  Crear Alquiler
                </h3>
                <p className="text-xs sm:text-sm text-primary-100 mt-0.5 sm:mt-1">
                  Paso {step}/2: {step === 1 ? 'Cliente' : 'Canastillas'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-white hover:text-gray-200 ml-2 p-1"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg mb-4">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* PASO 1: Seleccionar Cliente */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente o Punto de Venta *
                  </label>
                  {loadingSalePoints ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                    </div>
                  ) : (
                    <select
                      value={formData.sale_point_id}
                      onChange={(e) => setFormData({ ...formData, sale_point_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="">Seleccionar...</option>
                      <optgroup label="Puntos de Venta">
                        {salePoints.filter(sp => sp.client_type === 'PUNTO_VENTA').map(sp => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} - {sp.contact_name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Clientes Externos">
                        {salePoints.filter(sp => sp.client_type === 'CLIENTE_EXTERNO').map(sp => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} - {sp.contact_name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Alquiler *
                  </label>
                  <select
                    value={formData.rental_type}
                    onChange={(e) => setFormData({ ...formData, rental_type: e.target.value as 'INTERNO' | 'EXTERNO' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    <option value="EXTERNO">Externo (Por días - ${settings?.daily_rate || 2}/día)</option>
                    <option value="INTERNO">Interno (Tarifa fija - ${settings?.internal_rate || 1})</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.rental_type === 'EXTERNO'
                      ? 'Se cobrará por cantidad de días de alquiler'
                      : 'Tarifa fija sin importar la cantidad de días'
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Estimada de Retorno {formData.rental_type === 'EXTERNO' ? '' : '(Opcional)'}
                  </label>
                  <input
                    type="date"
                    value={formData.estimated_return_date}
                    onChange={(e) => setFormData({ ...formData, estimated_return_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Tarifa:</strong> {formData.rental_type === 'INTERNO'
                      ? `${formatCurrency(settings?.internal_rate || 1)} por canastilla (tarifa fija)`
                      : `${formatCurrency(settings?.daily_rate || 2)} por día por canastilla`
                    }
                  </p>
                  <p className="text-xs text-blue-700 mt-2">
                    💡 Se generará automáticamente una remisión de entrega al crear el alquiler
                  </p>
                </div>
              </div>
            )}

            {/* PASO 2: Seleccionar Canastillas */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Selector de lotes */}
                <CanastillaLoteSelector
                  canastillasDisponibles={canastillasDisponibles}
                  onLotesChange={handleLotesChange}
                  selectedIds={selectedCanastillas}
                />

                {/* Resumen total */}
                {selectedCanastillas.size > 0 && (
                  <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">
                        Total seleccionado: <strong>{selectedCanastillas.size}</strong> canastilla{selectedCanastillas.size !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {formData.estimated_return_date && (
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Total estimado:</p>
                        <p className="text-lg font-bold text-primary-600">{formatCurrency(totalEstimado)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              {step === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="w-full sm:w-auto text-sm"
                >
                  ← Volver
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="w-full sm:w-auto text-sm order-2 sm:order-1"
              >
                Cancelar
              </Button>
              {step === 1 ? (
                <Button onClick={handleNextStep} className="w-full sm:w-auto text-sm order-1 sm:order-2">
                  Siguiente →
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  loading={loading}
                  disabled={loading || selectedCanastillas.size === 0}
                  className="w-full sm:w-auto text-sm order-1 sm:order-2"
                >
                  {loading ? 'Creando...' : 'Crear Alquiler'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}