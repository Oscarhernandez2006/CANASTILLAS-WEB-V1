/** @module CrearAlquilerModal @description Modal para crear un nuevo alquiler interno o externo. */
import { useState, useEffect } from 'react'
import { Button } from './Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useSalePoints } from '@/hooks/useSalePoints'
import { useRentalSettings } from '@/hooks/useRentalSettings'
import type { Canastilla } from '@/types'
import { formatCurrency } from '@/utils/helpers'
import { logAuditEvent } from '@/services/auditService'

interface LoteGroup {
  key: string
  size: string
  color: string
  shape: string
  tipo_propiedad: string
  totalDisponible: number
  cantidadAlquilar: number
  canastillas: Canastilla[]
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
  
  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [loadingLotes, setLoadingLotes] = useState(false)

  const [formData, setFormData] = useState({
    sale_point_id: '',
    rental_type: 'EXTERNO' as 'INTERNO' | 'EXTERNO',
    estimated_return_date: '',
  })

  useEffect(() => {
    if (isOpen && step === 2) {
      fetchCanastillasYAgrupar()
    }
  }, [isOpen, step])

  const fetchCanastillasYAgrupar = async () => {
    if (!user) return

    setLoadingLotes(true)
    setError('')

    try {
      // Cargar TODAS las canastillas disponibles usando paginación
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
          .order('color', { ascending: true })
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

      // Agrupar por size + color + shape + tipo_propiedad
      const grouped: Record<string, LoteGroup> = {}

      for (const canastilla of allCanastillas) {
        const key = `${canastilla.size}-${canastilla.color}-${canastilla.shape || ''}-${canastilla.tipo_propiedad || 'PROPIA'}`

        if (!grouped[key]) {
          grouped[key] = {
            key,
            size: canastilla.size,
            color: canastilla.color,
            shape: canastilla.shape || '',
            tipo_propiedad: canastilla.tipo_propiedad || 'PROPIA',
            totalDisponible: 0,
            cantidadAlquilar: 0,
            canastillas: []
          }
        }

        grouped[key].totalDisponible++
        grouped[key].canastillas.push(canastilla)
      }

      setLotes(Object.values(grouped))
    } catch (err: any) {
      console.error('Error fetching canastillas:', err)
      setError('Error al cargar las canastillas: ' + err.message)
    } finally {
      setLoadingLotes(false)
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

  const handleCantidadChange = (key: string, cantidad: number) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadAlquilar: Math.min(Math.max(0, cantidad), lote.totalDisponible) }
          : lote
      )
    )
  }

  const handleAlquilarTodo = (key: string) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadAlquilar: lote.totalDisponible }
          : lote
      )
    )
  }

  const handleAlquilarTodoGlobal = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadAlquilar: lote.totalDisponible }))
    )
  }

  const handleLimpiarTodo = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadAlquilar: 0 }))
    )
  }

  // Calcular totales
  const totalCanastillasAlquilar = lotes.reduce((sum, lote) => sum + lote.cantidadAlquilar, 0)
  const totalCanastillasDisponibles = lotes.reduce((sum, lote) => sum + lote.totalDisponible, 0)

  const handlePreSubmit = async () => {
    if (totalCanastillasAlquilar === 0) {
      setError('Selecciona al menos una canastilla')
      return
    }
    setError('')
    setLoading(true)

    try {
      if (!user) throw new Error('Usuario no autenticado')

      // Recopilar los IDs de las canastillas seleccionadas de cada lote
      const canastillaIds: string[] = []
      for (const lote of lotes) {
        if (lote.cantidadAlquilar > 0) {
          const seleccionadas = lote.canastillas.slice(0, lote.cantidadAlquilar)
          canastillaIds.push(...seleccionadas.map(c => c.id))
        }
      }
      const dailyRate = formData.rental_type === 'INTERNO'
        ? (settings?.internal_rate || 1)
        : (settings?.daily_rate || 2)

      // 1. Generar número de remisión
      let remisionNumber: string
      try {
        const { data: remisionData, error: remisionError } = await supabase.rpc('generate_remision_number')
        if (remisionError) throw remisionError
        remisionNumber = remisionData
      } catch (rpcErr) {
        // Fallback: generar número local si el RPC falla
        remisionNumber = `RM-${Date.now().toString().slice(-8)}`
        console.warn('RPC generate_remision_number falló, usando fallback:', rpcErr)
      }

      // 2. Calcular días estimados
      let estimatedDays = 0
      if (formData.estimated_return_date) {
        const start = new Date(new Date().toDateString())
        const end = new Date(new Date(formData.estimated_return_date).toDateString())
        estimatedDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
      }

      // 3. Crear el alquiler con firma de entrega (pendiente firma del cliente)
      const { data: rental, error: rentalError } = await supabase
        .from('rentals')
        .insert([{
          sale_point_id: formData.sale_point_id,
          rental_type: formData.rental_type,
          status: 'PENDIENTE_FIRMA',
          start_date: new Date().toISOString(),
          estimated_return_date: formData.estimated_return_date || null,
          estimated_days: estimatedDays,
          daily_rate: dailyRate,
          created_by: user.id,
          remision_number: remisionNumber,
          remision_generated_at: new Date().toISOString(),
          pending_items_count: canastillaIds.length,
          returned_items_count: 0,
          total_invoiced: 0,
        }])
        .select()
        .single()

      if (rentalError) throw rentalError

      // 4. Insertar las canastillas (en lotes de 500)
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

      // 5. Actualizar estado de canastillas
      for (let i = 0; i < canastillaIds.length; i += BATCH_SIZE) {
        const batch = canastillaIds.slice(i, i + BATCH_SIZE)
        const { error: updateError } = await supabase
          .from('canastillas')
          .update({ status: 'EN_ALQUILER' })
          .in('id', batch)
        if (updateError) throw updateError
      }

      alert(`Alquiler creado. Pendiente confirmación con firma de servicio.\nRemisión: ${remisionNumber}`)

      await logAuditEvent({
        userId: user!.id,
        userName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        userRole: user?.role,
        action: 'CREATE',
        module: 'alquileres',
        description: `Crear alquiler ${formData.rental_type} - ${canastillaIds.length} canastilla(s). Remisión: ${remisionNumber}`,
        details: { remision: remisionNumber, tipo: formData.rental_type, cantidad: canastillaIds.length, cliente_id: formData.sale_point_id },
      })

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
    ? totalCanastillasAlquilar * (settings?.internal_rate || 1)  // INTERNO: tarifa fija por canastilla
    : (totalCanastillasAlquilar * (settings?.daily_rate || 2)) * getDaysCount()  // EXTERNO: (canastillas × precio) × días

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

            {/* PASO 2: Seleccionar Canastillas por Lote */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">
                      Canastillas a Alquilar por Lote
                    </h4>
                    {!loadingLotes && lotes.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleAlquilarTodoGlobal}
                          className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                        >
                          Seleccionar todas
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={handleLimpiarTodo}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          Limpiar
                        </button>
                      </div>
                    )}
                  </div>

                  {loadingLotes ? (
                    <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">Cargando canastillas...</p>
                      </div>
                    </div>
                  ) : lotes.length === 0 ? (
                    <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg bg-gray-50">
                      <p className="text-sm text-gray-500">No tienes canastillas disponibles para alquilar</p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Header de la tabla */}
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 uppercase">
                        <div className="col-span-5">Lote</div>
                        <div className="col-span-2 text-center">Disponibles</div>
                        <div className="col-span-3 text-center">Alquilar</div>
                        <div className="col-span-2 text-center">Acción</div>
                      </div>

                      {/* Filas de lotes */}
                      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                        {lotes.map((lote) => (
                          <div key={lote.key} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50">
                            <div className="col-span-5 flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                                style={{ backgroundColor: lote.color.toLowerCase().replace(/ /g, '') }}
                              />
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {lote.size} · {lote.color}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {lote.shape || 'Sin forma'} ·{' '}
                                  <span className={lote.tipo_propiedad === 'PROPIA' ? 'text-green-700' : 'text-amber-700'}>
                                    {lote.tipo_propiedad === 'PROPIA' ? 'Propia' : 'Alquilada'}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="text-sm font-semibold text-gray-700">
                                {lote.totalDisponible}
                              </span>
                            </div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                min="0"
                                max={lote.totalDisponible}
                                value={lote.cantidadAlquilar || ''}
                                onChange={(e) => handleCantidadChange(lote.key, e.target.value === '' ? 0 : parseInt(e.target.value))}
                                placeholder="0"
                                className="w-full px-3 py-1.5 text-center border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                              />
                            </div>
                            <div className="col-span-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleAlquilarTodo(lote.key)}
                                className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                              >
                                Todo
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Resumen */}
                      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
                        <div className="col-span-5 text-sm font-semibold text-gray-900">
                          TOTAL
                        </div>
                        <div className="col-span-2 text-center text-sm font-semibold text-gray-700">
                          {totalCanastillasDisponibles}
                        </div>
                        <div className="col-span-3 text-center text-sm font-bold text-primary-600">
                          {totalCanastillasAlquilar}
                        </div>
                        <div className="col-span-2"></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumen con total estimado */}
                {totalCanastillasAlquilar > 0 && (
                  <div className="flex items-center justify-between p-4 bg-primary-50 border border-primary-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-primary-800">
                        Se alquilarán <strong>{totalCanastillasAlquilar}</strong> canastilla{totalCanastillasAlquilar !== 1 ? 's' : ''}
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
                  onClick={handlePreSubmit}
                  loading={loading}
                  disabled={loading || loadingLotes || totalCanastillasAlquilar === 0}
                  className="w-full sm:w-auto text-sm order-1 sm:order-2"
                >
                  {loading ? 'Creando...' : `Crear Alquiler (${totalCanastillasAlquilar})`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}