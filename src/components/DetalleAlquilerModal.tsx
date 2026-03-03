import { useState, useEffect } from 'react'
import { Button } from './Button'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/utils/helpers'
import type { Rental, Canastilla } from '@/types'

interface CanastillaConDetalle extends Canastilla {
  lote?: {
    id: string
    size: string
    color: string
  }
}

interface DetalleAlquilerModalProps {
  isOpen: boolean
  onClose: () => void
  rental: Rental | null
}

interface LoteAgrupado {
  size: string
  color: string
  ubicacion: string
  cantidad: number
  canastillas: CanastillaConDetalle[]
}

export function DetalleAlquilerModal({
  isOpen,
  onClose,
  rental,
}: DetalleAlquilerModalProps) {
  const [canastillas, setCanastillas] = useState<CanastillaConDetalle[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'lotes' | 'lista'>('lotes')

  useEffect(() => {
    if (isOpen && rental) {
      fetchCanastillas()
    }
  }, [isOpen, rental])

  const fetchCanastillas = async () => {
    if (!rental) return

    setLoading(true)
    try {
      // Obtener los IDs de canastillas del alquiler
      const canastillaIds = rental.rental_items?.map(item => item.canastilla_id) || []

      if (canastillaIds.length === 0) {
        setCanastillas([])
        return
      }

      // Obtener detalles de las canastillas
      const { data, error } = await supabase
        .from('canastillas')
        .select(`
          *,
          lote:lotes(id, size, color)
        `)
        .in('id', canastillaIds)
        .order('codigo')

      if (error) throw error

      setCanastillas(data || [])
    } catch (error) {
      console.error('Error fetching canastillas:', error)
      setCanastillas([])
    } finally {
      setLoading(false)
    }
  }

  // Agrupar canastillas por lote (tamaño, color, ubicación)
  const lotesAgrupados: LoteAgrupado[] = canastillas.reduce((acc, canastilla) => {
    const key = `${canastilla.size || 'N/A'}-${canastilla.color || 'N/A'}-${canastilla.current_location || 'N/A'}`

    const existingLote = acc.find(l =>
      l.size === (canastilla.size || 'N/A') &&
      l.color === (canastilla.color || 'N/A') &&
      l.ubicacion === (canastilla.current_location || 'N/A')
    )

    if (existingLote) {
      existingLote.cantidad++
      existingLote.canastillas.push(canastilla)
    } else {
      acc.push({
        size: canastilla.size || 'N/A',
        color: canastilla.color || 'N/A',
        ubicacion: canastilla.current_location || 'N/A',
        cantidad: 1,
        canastillas: [canastilla],
      })
    }

    return acc
  }, [] as LoteAgrupado[])

  const calculateCurrentDays = () => {
    if (!rental) return 0
    const start = new Date(rental.start_date)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const calculateCurrentTotal = () => {
    if (!rental) return 0

    // Si es INTERNO, es tarifa fija por canastilla
    if (rental.rental_type === 'INTERNO') {
      return canastillas.length * rental.daily_rate
    }

    // Si es EXTERNO, es (cantidad × tarifa) × días
    const days = calculateCurrentDays()
    return (canastillas.length * rental.daily_rate) * days
  }

  if (!isOpen || !rental) return null

  const currentDays = calculateCurrentDays()
  const currentTotal = calculateCurrentTotal()

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Detalle del Alquiler
                </h3>
                <p className="text-primary-100 text-sm mt-1">
                  {rental.sale_point?.name}
                </p>
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

          <div className="px-6 py-6">
            {/* Información del alquiler */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Tipo de Alquiler</p>
                <p className={`text-sm font-semibold ${rental.rental_type === 'INTERNO' ? 'text-purple-600' : 'text-pink-600'}`}>
                  {rental.rental_type}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Canastillas</p>
                <p className="text-sm font-semibold text-gray-900">{canastillas.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Días transcurridos</p>
                <p className="text-sm font-semibold text-gray-900">{currentDays} días</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">
                  {rental.rental_type === 'INTERNO' ? 'Tarifa fija' : 'Tarifa diaria'}
                </p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(rental.daily_rate)}</p>
              </div>
            </div>

            {/* Información del cliente */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Información del Cliente</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-blue-700">Punto de venta:</p>
                  <p className="font-medium text-blue-900">{rental.sale_point?.name}</p>
                </div>
                <div>
                  <p className="text-blue-700">Contacto:</p>
                  <p className="font-medium text-blue-900">{rental.sale_point?.contact_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-blue-700">Teléfono:</p>
                  <p className="font-medium text-blue-900">{rental.sale_point?.contact_phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-blue-700">Dirección:</p>
                  <p className="font-medium text-blue-900">{rental.sale_point?.address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-blue-700">Fecha de salida:</p>
                  <p className="font-medium text-blue-900">{formatDate(rental.start_date)}</p>
                </div>
                {rental.estimated_return_date && (
                  <div>
                    <p className="text-blue-700">Retorno estimado:</p>
                    <p className="font-medium text-blue-900">{formatDate(rental.estimated_return_date)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Total actual */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Total Actual</p>
                  {rental.rental_type === 'EXTERNO' && (
                    <p className="text-xs text-green-600 mt-1">
                      ({canastillas.length} canastillas × {formatCurrency(rental.daily_rate)}) × {currentDays} días
                    </p>
                  )}
                  {rental.rental_type === 'INTERNO' && (
                    <p className="text-xs text-green-600 mt-1">
                      {canastillas.length} canastillas × {formatCurrency(rental.daily_rate)} (tarifa fija)
                    </p>
                  )}
                </div>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(currentTotal)}</p>
              </div>
            </div>

            {/* Toggle de vista */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-900">Canastillas del Alquiler</h4>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('lotes')}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    viewMode === 'lotes' ? 'bg-white shadow text-primary-600' : 'text-gray-600'
                  }`}
                >
                  Por Lotes
                </button>
                <button
                  onClick={() => setViewMode('lista')}
                  className={`px-3 py-1 text-xs font-medium rounded ${
                    viewMode === 'lista' ? 'bg-white shadow text-primary-600' : 'text-gray-600'
                  }`}
                >
                  Lista Completa
                </button>
              </div>
            </div>

            {/* Contenido */}
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : viewMode === 'lotes' ? (
              /* Vista por lotes */
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {lotesAgrupados.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No hay canastillas en este alquiler</p>
                ) : (
                  lotesAgrupados.map((lote, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {lote.size} - {lote.color}
                            </p>
                            <p className="text-xs text-gray-500">
                              Ubicación: {lote.ubicacion}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary-600">{lote.cantidad}</p>
                          <p className="text-xs text-gray-500">unidades</p>
                        </div>
                      </div>
                      {/* Mostrar códigos */}
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Códigos:</p>
                        <div className="flex flex-wrap gap-1">
                          {lote.canastillas.slice(0, 10).map(c => (
                            <span key={c.id} className="px-2 py-0.5 bg-white text-xs text-gray-700 rounded border">
                              {c.codigo}
                            </span>
                          ))}
                          {lote.canastillas.length > 10 && (
                            <span className="px-2 py-0.5 bg-gray-200 text-xs text-gray-600 rounded">
                              +{lote.canastillas.length - 10} más
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Vista lista completa */
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Código</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tamaño</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Color</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ubicación</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Condición</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {canastillas.map(canastilla => (
                      <tr key={canastilla.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{canastilla.codigo}</td>
                        <td className="px-3 py-2 text-gray-600">{canastilla.size || 'N/A'}</td>
                        <td className="px-3 py-2 text-gray-600">{canastilla.color || 'N/A'}</td>
                        <td className="px-3 py-2 text-gray-600">{canastilla.current_location || 'N/A'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            canastilla.condition === 'BUENA' ? 'bg-green-100 text-green-800' :
                            canastilla.condition === 'REGULAR' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {canastilla.condition || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notas */}
            {rental.notes && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs font-medium text-yellow-800 mb-1">Notas:</p>
                <p className="text-sm text-yellow-700">{rental.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
