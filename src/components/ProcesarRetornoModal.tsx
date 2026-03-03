import { useState, useEffect } from 'react'
import { Button } from './Button'
import type { Rental, Canastilla } from '@/types'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { useRentalReturns } from '@/hooks/useRentalReturns'
import { useAuthStore } from '@/store/authStore'
import { openFacturaDevolucionPDF } from '@/utils/facturaDevolucionGenerator'
import { supabase } from '@/lib/supabase'

interface ProcesarRetornoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  rental: Rental | null
}

interface LoteGroup {
  key: string
  size: string
  color: string
  totalDisponible: number
  cantidadDevolver: number
  canastillas: Array<{
    id: string
    rental_item_id: string
    canastilla: Canastilla
  }>
}

export function ProcesarRetornoModal({ isOpen, onClose, onSuccess, rental }: ProcesarRetornoModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [error, setError] = useState('')
  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [notes, setNotes] = useState('')

  const { user } = useAuthStore()
  const { createReturn, calculateReturnAmount, calculateDaysSinceStart } = useRentalReturns()

  // Inicializar los lotes cuando se abre el modal
  useEffect(() => {
    if (rental && isOpen) {
      loadRentalItems()
    }
  }, [rental, isOpen])

  const loadRentalItems = async () => {
    if (!rental) return

    setLoadingItems(true)
    setError('')

    try {
      // Obtener IDs de canastillas ya devueltas
      const returnedCanastillaIds = new Set<string>()
      if ((rental as any).rental_returns) {
        for (const ret of (rental as any).rental_returns) {
          if (ret.rental_return_items) {
            for (const item of ret.rental_return_items) {
              if (item.canastilla?.id) {
                returnedCanastillaIds.add(item.canastilla.id)
              }
            }
          }
        }
      }

      // Cargar TODOS los rental_items con paginación
      const PAGE_SIZE = 1000
      let allRentalItems: any[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data: itemsBatch, error: itemsError } = await supabase
          .from('rental_items')
          .select('id, canastilla:canastillas(*)')
          .eq('rental_id', rental.id)
          .range(offset, offset + PAGE_SIZE - 1)

        if (itemsError) throw itemsError

        if (itemsBatch && itemsBatch.length > 0) {
          allRentalItems = [...allRentalItems, ...itemsBatch]
          offset += PAGE_SIZE
          hasMore = itemsBatch.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      // Filtrar canastillas pendientes y agrupar por tamaño+color
      const pendingItems = allRentalItems
        .filter(item => item.canastilla && !returnedCanastillaIds.has(item.canastilla.id))
        .map(item => ({
          id: item.canastilla.id,
          rental_item_id: item.id || '',
          canastilla: item.canastilla
        }))

      // Agrupar por size+color
      const grouped: Record<string, LoteGroup> = {}

      for (const item of pendingItems) {
        const key = `${item.canastilla.size}-${item.canastilla.color}`

        if (!grouped[key]) {
          grouped[key] = {
            key,
            size: item.canastilla.size,
            color: item.canastilla.color,
            totalDisponible: 0,
            cantidadDevolver: 0, // Por defecto 0, el usuario elige
            canastillas: []
          }
        }

        grouped[key].totalDisponible++
        grouped[key].canastillas.push(item)
      }

      setLotes(Object.values(grouped))
      setNotes('')
    } catch (err: any) {
      console.error('Error loading rental items:', err)
      setError('Error al cargar las canastillas: ' + err.message)
    } finally {
      setLoadingItems(false)
    }
  }

  if (!rental) return null

  const actualDays = calculateDaysSinceStart(rental.start_date)

  // Calcular totales
  const totalCanastillasDevolver = lotes.reduce((sum, lote) => sum + lote.cantidadDevolver, 0)
  const totalCanastillasPendientes = lotes.reduce((sum, lote) => sum + lote.totalDisponible, 0)
  const pendingAfterReturn = totalCanastillasPendientes - totalCanastillasDevolver
  const isPartialReturn = pendingAfterReturn > 0 && totalCanastillasDevolver > 0

  // Calcular monto total
  const totalAmount = calculateReturnAmount(
    totalCanastillasDevolver,
    rental.daily_rate,
    actualDays,
    rental.rental_type
  )

  const handleCantidadChange = (key: string, cantidad: number) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadDevolver: Math.min(Math.max(0, cantidad), lote.totalDisponible) }
          : lote
      )
    )
  }

  const handleDevolverTodo = (key: string) => {
    setLotes(prev =>
      prev.map(lote =>
        lote.key === key
          ? { ...lote, cantidadDevolver: lote.totalDisponible }
          : lote
      )
    )
  }

  const handleDevolverTodoGlobal = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadDevolver: lote.totalDisponible }))
    )
  }

  const handleLimpiarTodo = () => {
    setLotes(prev =>
      prev.map(lote => ({ ...lote, cantidadDevolver: 0 }))
    )
  }

  const handleProcessReturn = async () => {
    if (totalCanastillasDevolver === 0) {
      setError('Debe especificar al menos una canastilla para devolver')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Seleccionar las canastillas a devolver de cada lote
      const canastillasADevolver: Canastilla[] = []
      const canastillaIds: string[] = []
      const rentalItemIds: string[] = []

      for (const lote of lotes) {
        if (lote.cantidadDevolver > 0) {
          // Tomar las primeras N canastillas del lote
          const seleccionadas = lote.canastillas.slice(0, lote.cantidadDevolver)

          for (const item of seleccionadas) {
            canastillasADevolver.push(item.canastilla)
            canastillaIds.push(item.id)
            rentalItemIds.push(item.rental_item_id)
          }
        }
      }

      const result = await createReturn({
        rentalId: rental.id,
        canastillaIds,
        rentalItemIds,
        daysCharged: actualDays,
        amount: totalAmount,
        notes: notes || undefined,
        processedBy: user?.id || ''
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      // Generar y abrir la factura PDF
      await openFacturaDevolucionPDF({
        rental,
        returnData: {
          invoiceNumber: result.invoiceNumber!,
          returnDate: new Date().toISOString(),
          daysCharged: actualDays,
          amount: totalAmount,
          notes,
          canastillas: canastillasADevolver
        },
        isPartial: isPartialReturn,
        pendingCount: pendingAfterReturn
      })

      const message = isPartialReturn
        ? `✅ Devolución parcial procesada\n\nFactura: ${result.invoiceNumber}\nCanastillas devueltas: ${totalCanastillasDevolver}\nPendientes: ${pendingAfterReturn}\nTotal: ${formatCurrency(totalAmount)}`
        : `✅ Retorno completo procesado\n\nFactura: ${result.invoiceNumber}\nTotal: ${formatCurrency(totalAmount)}`

      alert(message)
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error processing return:', err)
      setError(err.message || 'Error al procesar el retorno')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-[calc(100%-2rem)] sm:max-w-2xl mx-4 sm:mx-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary-600 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                Procesar Retorno
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-white hover:text-gray-200 p-1"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-h-[65vh] overflow-y-auto">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Información del cliente y alquiler */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Cliente</h4>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">{rental.sale_point?.name}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">{rental.sale_point?.contact_name}</p>
                  <p className="text-xs sm:text-sm text-gray-500">{rental.sale_point?.contact_phone}</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Detalles</h4>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      rental.rental_type === 'INTERNO'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-pink-100 text-pink-800'
                    }`}>
                      {rental.rental_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {rental.remision_number || 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600">Inicio: {formatDate(rental.start_date)}</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-900">Días: {actualDays}</p>
                </div>
              </div>
            </div>

            {/* Selector de cantidades por lote */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">
                  Canastillas a Devolver por Lote
                </h4>
                {!loadingItems && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDevolverTodoGlobal}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                    >
                      Devolver todas
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

              {loadingItems ? (
                <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Cargando canastillas...</p>
                  </div>
                </div>
              ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header de la tabla */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-600 uppercase">
                  <div className="col-span-5">Lote (Tamaño - Color)</div>
                  <div className="col-span-2 text-center">Disponibles</div>
                  <div className="col-span-3 text-center">Devolver</div>
                  <div className="col-span-2 text-center">Acción</div>
                </div>

                {/* Filas de lotes */}
                <div className="divide-y divide-gray-100">
                  {lotes.map((lote) => (
                    <div key={lote.key} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50">
                      <div className="col-span-5">
                        <span className="text-sm font-medium text-gray-900">
                          {lote.size} - {lote.color}
                        </span>
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
                          value={lote.cantidadDevolver || ''}
                          onChange={(e) => handleCantidadChange(lote.key, e.target.value === '' ? 0 : parseInt(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-1.5 text-center border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div className="col-span-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDevolverTodo(lote.key)}
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
                    {totalCanastillasPendientes}
                  </div>
                  <div className="col-span-3 text-center text-sm font-bold text-primary-600">
                    {totalCanastillasDevolver}
                  </div>
                  <div className="col-span-2"></div>
                </div>
              </div>
              )}

              {/* Indicador de restantes */}
              {totalCanastillasDevolver > 0 && (
                <div className="mt-2 text-sm">
                  {isPartialReturn ? (
                    <span className="text-orange-600 font-medium">
                      Quedarán {pendingAfterReturn} canastillas pendientes
                    </span>
                  ) : (
                    <span className="text-green-600 font-medium">
                      Se devolverán todas las canastillas
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Observaciones sobre la devolución..."
              />
            </div>

            {/* Resumen de facturación */}
            {totalCanastillasDevolver > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Resumen de Facturación</h4>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {rental.rental_type === 'INTERNO' ? 'Tarifa fija:' : 'Tarifa diaria:'}
                    </span>
                    <span className="font-medium text-gray-900">{formatCurrency(rental.daily_rate)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Canastillas a facturar:</span>
                    <span className="font-medium text-gray-900">{totalCanastillasDevolver}</span>
                  </div>
                  {rental.rental_type === 'EXTERNO' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Días transcurridos:</span>
                      <span className="font-medium text-gray-900">{actualDays}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-gray-500 pt-1">
                    <span>Fórmula:</span>
                    <span>
                      {rental.rental_type === 'INTERNO'
                        ? `${totalCanastillasDevolver} × ${formatCurrency(rental.daily_rate)}`
                        : `${totalCanastillasDevolver} × ${formatCurrency(rental.daily_rate)} × ${actualDays} días`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                    <span className="text-gray-900">Total a cobrar:</span>
                    <span className="text-primary-600">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Alertas */}
            {isPartialReturn && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-orange-800">Devolución Parcial</p>
                    <p className="text-sm text-orange-700 mt-1">
                      El alquiler permanecerá <strong>ACTIVO</strong> con {pendingAfterReturn} canastillas pendientes.
                      Los días se seguirán contando hasta que se devuelvan todas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {totalCanastillasDevolver === totalCanastillasPendientes && totalCanastillasDevolver > 0 && (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>✓</strong> Devolución completa - El alquiler se marcará como <strong>RETORNADO</strong>
                </p>
                <p className="text-sm text-green-800 mt-1">
                  <strong>✓</strong> Las canastillas volverán a estado <strong>DISPONIBLE</strong>
                </p>
                <p className="text-sm text-green-800 mt-1">
                  <strong>✓</strong> Se generará la factura final
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full sm:w-auto text-sm order-2 sm:order-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProcessReturn}
              loading={loading}
              disabled={loading || loadingItems || totalCanastillasDevolver === 0}
              className="w-full sm:w-auto text-sm order-1 sm:order-2"
            >
              {loading
                ? 'Procesando...'
                : isPartialReturn
                  ? `Devolución (${totalCanastillasDevolver})`
                  : `Confirmar (${totalCanastillasDevolver})`
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
