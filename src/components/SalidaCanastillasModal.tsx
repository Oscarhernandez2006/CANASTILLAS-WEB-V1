import { useState, useEffect } from 'react'
import { Button } from './Button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface Lote {
  id: string
  color: string
  size: string
  shape?: string
  condition?: string
  tipo_propiedad: string
  cantidad: number
  canastillas: Array<{
    id: string
    codigo: string
  }>
}

interface SalidaCanastillasModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SalidaCanastillasModal({
  isOpen,
  onClose,
  onSuccess,
}: SalidaCanastillasModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingLotes, setLoadingLotes] = useState(false)
  const [error, setError] = useState('')
  const [lotes, setLotes] = useState<Lote[]>([])
  const [tipoSalida, setTipoSalida] = useState<'ALQUILADAS' | 'PROPIAS'>('ALQUILADAS')
  const [cantidades, setCantidades] = useState<Map<string, number>>(new Map())
  const { user } = useAuthStore()

  useEffect(() => {
    if (isOpen) {
      fetchLotes()
    }
  }, [isOpen, tipoSalida])

  const fetchLotes = async () => {
    setLoadingLotes(true)
    setError('')
    try {
      const tipoPropiedad = tipoSalida === 'ALQUILADAS' ? 'ALQUILADA' : 'PROPIA'

      // Cargar TODAS las canastillas usando paginación interna
      const PAGE_SIZE = 1000
      let allCanastillas: any[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error: canErr } = await supabase
          .from('canastillas')
          .select('*')
          .eq('tipo_propiedad', tipoPropiedad)
          .eq('status', 'DISPONIBLE')
          .order('color', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (canErr) throw canErr

        if (data && data.length > 0) {
          allCanastillas = [...allCanastillas, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      const canastillas = allCanastillas

      // Agrupar en lotes
      const lotesMap = new Map<string, Lote>()

      canastillas?.forEach((c) => {
        const key = `${c.color}|${c.size}|${c.shape || 'SIN_FORMA'}|${c.condition || 'SIN_CONDICION'}`

        if (!lotesMap.has(key)) {
          lotesMap.set(key, {
            id: key,
            color: c.color,
            size: c.size,
            shape: c.shape,
            condition: c.condition,
            tipo_propiedad: tipoPropiedad,
            cantidad: 0,
            canastillas: [],
          })
        }

        const lote = lotesMap.get(key)!
        lote.cantidad += 1
        lote.canastillas.push({
          id: c.id,
          codigo: c.codigo,
        })
      })

      const lotesArray = Array.from(lotesMap.values())
      setLotes(lotesArray)
      setCantidades(new Map())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar lotes')
    } finally {
      setLoadingLotes(false)
    }
  }

  const setCantidadLote = (loteId: string, cantidad: number) => {
    const newCantidades = new Map(cantidades)
    if (cantidad <= 0) {
      newCantidades.delete(loteId)
    } else {
      newCantidades.set(loteId, cantidad)
    }
    setCantidades(newCantidades)
  }

  const getTotalSeleccionado = () => {
    let total = 0
    cantidades.forEach((cant) => {
      total += cant
    })
    return total
  }

  const handleSubmit = async () => {
    if (cantidades.size === 0) {
      setError('Selecciona al menos una cantidad')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Recopilar todas las canastillas a procesar
      const canastillasAProcesar: Array<{
        loteId: string
        canastillas: Array<{ id: string; codigo: string }>
        cantidad: number
      }> = []

      cantidades.forEach((cantidad, loteId) => {
        const lote = lotes.find((l) => l.id === loteId)
        if (lote) {
          canastillasAProcesar.push({
            loteId,
            canastillas: lote.canastillas.slice(0, cantidad),
            cantidad,
          })
        }
      })

      if (tipoSalida === 'ALQUILADAS') {
        // REGISTRAR EN SALIDAS (NO se eliminan del inventario)
        const registrosSalida = []

        for (const item of canastillasAProcesar) {
          for (const canastilla of item.canastillas) {
            registrosSalida.push({
              canastilla_id: canastilla.id,
              codigo: canastilla.codigo,
              cliente_nombre: 'Cliente',
              cliente_contacto: null,
              estado: 'EN_TRANSITO',
              observaciones: null,
              fecha_salida: new Date().toISOString(),
            })
          }
        }

        // Insertar en lotes para evitar límite de 1000
        const BATCH_SIZE = 500
        for (let i = 0; i < registrosSalida.length; i += BATCH_SIZE) {
          const batch = registrosSalida.slice(i, i + BATCH_SIZE)
          const { error: insertError } = await supabase
            .from('canastillas_salidas')
            .insert(batch)
          if (insertError) throw insertError
        }

        // Actualizar estado a EN_ALQUILER en lotes
        const canastillaIds = canastillasAProcesar.flatMap((item) =>
          item.canastillas.map((c) => c.id)
        )

        for (let i = 0; i < canastillaIds.length; i += BATCH_SIZE) {
          const batch = canastillaIds.slice(i, i + BATCH_SIZE)
          const { error: updateError } = await supabase
            .from('canastillas')
            .update({ status: 'EN_ALQUILER' })
            .in('id', batch)
          if (updateError) throw updateError
        }

        alert(`✅ Se registraron ${getTotalSeleccionado()} canastilla(s) como salida`)
      } else {
        // DAR DE BAJA PROPIAS (SE ELIMINAN DEL INVENTARIO)
        const BATCH_SIZE = 500
        const allCanastillaIds = canastillasAProcesar.flatMap((item) =>
          item.canastillas.map((c) => c.id)
        )

        // Obtener datos completos en lotes
        let lotesFull: any[] = []
        for (let i = 0; i < allCanastillaIds.length; i += BATCH_SIZE) {
          const batchIds = allCanastillaIds.slice(i, i + BATCH_SIZE)
          const { data: batchData } = await supabase
            .from('canastillas')
            .select('*')
            .in('id', batchIds)
          if (batchData) {
            lotesFull = [...lotesFull, ...batchData]
          }
        }

        const registrosBaja = lotesFull.map((c) => ({
          canastilla_id: c.id,
          codigo: c.codigo,
          qr_code: c.qr_code,
          size: c.size,
          color: c.color,
          shape: c.shape || null,
          condition: c.condition,
          tipo_propiedad: c.tipo_propiedad,
          proveedor_nombre: c.proveedor_nombre || null,
          proveedor_contacto: c.proveedor_contacto || null,
          current_location: c.current_location || null,
          current_area: c.current_area || null,
          motivo_baja: 'Salida del inventario',
          tipo_baja: 'BAJA_PROPIA',
          dado_baja_por: user?.id || null,
          created_at_original: c.created_at,
        }))

        // Insertar registros de baja en lotes
        for (let i = 0; i < registrosBaja.length; i += BATCH_SIZE) {
          const batch = registrosBaja.slice(i, i + BATCH_SIZE)
          const { error: insertError } = await supabase
            .from('canastillas_bajas')
            .insert(batch)
          if (insertError) throw insertError
        }

        // Eliminar del inventario en lotes
        for (let i = 0; i < allCanastillaIds.length; i += BATCH_SIZE) {
          const batchIds = allCanastillaIds.slice(i, i + BATCH_SIZE)
          const { error: deleteError } = await supabase
            .from('canastillas')
            .delete()
            .in('id', batchIds)
          if (deleteError) throw deleteError
        }

        alert(`✅ Se dieron de baja ${getTotalSeleccionado()} canastilla(s)`)
      }

      onSuccess()
      handleClose()
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error al procesar la salida')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setCantidades(new Map())
    setError('')
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
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-red-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Salida de Canastillas
                </h3>
                <p className="text-red-100 text-sm mt-1">
                  {tipoSalida === 'ALQUILADAS'
                    ? 'Registrar salida de canastillas alquiladas'
                    : 'Dar de baja canastillas propias'
                  }
                </p>
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

          <div className="px-6 py-6 space-y-6">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Tipo de salida */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Salida
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipoSalida"
                    value="ALQUILADAS"
                    checked={tipoSalida === 'ALQUILADAS'}
                    onChange={(e) => {
                      setTipoSalida(e.target.value as 'ALQUILADAS' | 'PROPIAS')
                      setCantidades(new Map())
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">📤 Salida de Alquiladas</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipoSalida"
                    value="PROPIAS"
                    checked={tipoSalida === 'PROPIAS'}
                    onChange={(e) => {
                      setTipoSalida(e.target.value as 'ALQUILADAS' | 'PROPIAS')
                      setCantidades(new Map())
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">🗑️ Dar de Baja Propias</span>
                </label>
              </div>
            </div>

            {/* Lista de lotes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Lotes Disponibles
              </label>

              {loadingLotes ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : lotes.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-yellow-800">
                    {tipoSalida === 'ALQUILADAS'
                      ? 'No hay canastillas alquiladas disponibles'
                      : 'No hay canastillas propias disponibles para dar de baja'
                    }
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {lotes.map((lote) => (
                    <div
                      key={lote.id}
                      className="px-4 py-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-6 h-6 rounded-full border-2 border-gray-300"
                            style={{
                              backgroundColor: lote.color.toLowerCase().replace(/ /g, ''),
                            }}
                          />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {lote.color} | {lote.size}
                            </p>
                            <p className="text-xs text-gray-500">
                              {lote.shape && `Forma: ${lote.shape}`}
                              {lote.shape && lote.condition && ' | '}
                              {lote.condition && `Condición: ${lote.condition}`}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">
                          Total: {lote.cantidad}
                        </span>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg">
                          <button
                            type="button"
                            onClick={() => {
                              const actual = cantidades.get(lote.id) || 0
                              setCantidadLote(lote.id, Math.max(0, actual - 1))
                            }}
                            className="px-2 py-1 text-gray-600 hover:text-gray-900"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={lote.cantidad}
                            value={cantidades.get(lote.id) || ''}
                            onChange={(e) =>
                              setCantidadLote(lote.id, e.target.value === '' ? 0 : parseInt(e.target.value))
                            }
                            placeholder="0"
                            className="w-12 text-center text-sm font-medium border-0 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const actual = cantidades.get(lote.id) || 0
                              setCantidadLote(lote.id, Math.min(lote.cantidad, actual + 1))
                            }}
                            className="px-2 py-1 text-gray-600 hover:text-gray-900"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen */}
            {getTotalSeleccionado() > 0 && (
              <div
                className={`p-4 rounded-lg ${
                  tipoSalida === 'ALQUILADAS'
                    ? 'bg-orange-50 border border-orange-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    tipoSalida === 'ALQUILADAS'
                      ? 'text-orange-800'
                      : 'text-red-800'
                  }`}
                >
                  {tipoSalida === 'ALQUILADAS'
                    ? `Se registrarán ${getTotalSeleccionado()} canastilla(s) como salida`
                    : `Se darán de baja ${getTotalSeleccionado()} canastilla(s)`
                  }
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
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
              onClick={handleSubmit}
              loading={loading}
              disabled={loading || getTotalSeleccionado() === 0}
              className={
                tipoSalida === 'ALQUILADAS'
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {loading
                ? 'Procesando...'
                : tipoSalida === 'ALQUILADAS'
                  ? '📤 Confirmar Salida'
                  : '🗑️ Confirmar Baja'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}