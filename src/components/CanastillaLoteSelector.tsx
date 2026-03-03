import { useState } from 'react'
import { useCanastillaAttributes } from '@/hooks/useCanastillaAttributes'
import type { Canastilla } from '@/types'

interface LoteItem {
  id: string
  size: string
  color: string
  shape: string
  ubicacion: string
  cantidad: number
  canastillaIds: string[]
}

interface CanastillaLoteSelectorProps {
  canastillasDisponibles: Canastilla[]
  onLotesChange: (lotes: LoteItem[]) => void
  selectedIds: Set<string>
}

export function CanastillaLoteSelector({
  canastillasDisponibles,
  onLotesChange,
  selectedIds,
}: CanastillaLoteSelectorProps) {
  const [lotes, setLotes] = useState<LoteItem[]>([])

  // Filtros
  const [filters, setFilters] = useState({
    size: '',
    color: '',
    shape: '',
    ubicacion: '',
    area: '',
    condition: '',
  })

  const [cantidadLote, setCantidadLote] = useState<string>('1')

  const colores = useCanastillaAttributes('COLOR')
  const tamaños = useCanastillaAttributes('SIZE')
  const formas = useCanastillaAttributes('FORMA')
  const ubicaciones = useCanastillaAttributes('UBICACION')
  const areas = useCanastillaAttributes('AREA')
  const condiciones = useCanastillaAttributes('CONDICION')

  // Canastillas NO seleccionadas (disponibles para agregar)
  const canastillasNoSeleccionadas = canastillasDisponibles.filter(c => !selectedIds.has(c.id))

  // Filtrar canastillas no seleccionadas
  const canastillasFiltradas = canastillasNoSeleccionadas.filter(c => {
    if (filters.size && c.size !== filters.size) return false
    if (filters.color && c.color !== filters.color) return false
    if (filters.shape && c.shape !== filters.shape) return false
    if (filters.ubicacion && c.current_location !== filters.ubicacion) return false
    if (filters.area && c.current_area !== filters.area) return false
    if (filters.condition && c.condition !== filters.condition) return false
    return true
  })

  // Canastilla de ejemplo (primera de las filtradas)
  const canastillaEjemplo = canastillasFiltradas.length > 0 ? canastillasFiltradas[0] : null

  // Verificar si hay algún filtro activo
  const hayFiltrosActivos = filters.size || filters.color || filters.shape || filters.ubicacion || filters.area || filters.condition

  const agregarLote = () => {
    if (canastillasFiltradas.length === 0) {
      alert('No hay canastillas disponibles con esos filtros')
      return
    }

    const cantidadNum = Math.max(1, parseInt(cantidadLote) || 1)
    const cantidad = Math.min(cantidadNum, canastillasFiltradas.length)
    const canastillasParaLote = canastillasFiltradas.slice(0, cantidad)

    // Obtener valores únicos de las canastillas seleccionadas para el lote
    const sizesUnicos = [...new Set(canastillasParaLote.map(c => c.size))].filter(Boolean)
    const coloresUnicos = [...new Set(canastillasParaLote.map(c => c.color))].filter(Boolean)
    const formasUnicas = [...new Set(canastillasParaLote.map(c => c.shape))].filter(Boolean)
    const ubicacionesUnicas = [...new Set(canastillasParaLote.map(c => c.current_location))].filter(Boolean)

    const nuevoLote: LoteItem = {
      id: Date.now().toString(),
      size: filters.size || (sizesUnicos.length === 1 ? sizesUnicos[0] : sizesUnicos.length > 1 ? 'Varios' : 'N/A'),
      color: filters.color || (coloresUnicos.length === 1 ? coloresUnicos[0] : coloresUnicos.length > 1 ? 'Varios' : 'N/A'),
      shape: filters.shape || (formasUnicas.length === 1 ? formasUnicas[0] : formasUnicas.length > 1 ? 'Varias' : 'N/A'),
      ubicacion: filters.ubicacion || (ubicacionesUnicas.length === 1 ? ubicacionesUnicas[0] : ubicacionesUnicas.length > 1 ? 'Varias' : 'N/A'),
      cantidad,
      canastillaIds: canastillasParaLote.map(c => c.id),
    }

    const nuevosLotes = [...lotes, nuevoLote]
    setLotes(nuevosLotes)
    onLotesChange(nuevosLotes)
    setCantidadLote(1)
  }

  const eliminarLote = (loteId: string) => {
    const nuevosLotes = lotes.filter(l => l.id !== loteId)
    setLotes(nuevosLotes)
    onLotesChange(nuevosLotes)
  }

  const limpiarFiltros = () => {
    setFilters({
      size: '',
      color: '',
      shape: '',
      ubicacion: '',
      area: '',
      condition: '',
    })
  }

  const totalCanastillas = lotes.reduce((sum, lote) => sum + lote.cantidad, 0)

  // Si no hay canastillas disponibles, mostrar mensaje
  if (canastillasDisponibles.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800">No hay canastillas disponibles</p>
            <p className="text-xs text-yellow-700 mt-1">No tienes canastillas disponibles para seleccionar en este momento.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Filtrar Canastillas</h3>
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tamaño</label>
            <select
              value={filters.size}
              onChange={(e) => setFilters({ ...filters, size: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos</option>
              {tamaños.attributes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Color</label>
            <select
              value={filters.color}
              onChange={(e) => setFilters({ ...filters, color: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos</option>
              {colores.attributes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Forma</label>
            <select
              value={filters.shape}
              onChange={(e) => setFilters({ ...filters, shape: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas</option>
              {formas.attributes.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ubicación</label>
            <select
              value={filters.ubicacion}
              onChange={(e) => setFilters({ ...filters, ubicacion: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas</option>
              {ubicaciones.attributes.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Área</label>
            <select
              value={filters.area}
              onChange={(e) => setFilters({ ...filters, area: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas</option>
              {areas.attributes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Condición</label>
            <select
              value={filters.condition}
              onChange={(e) => setFilters({ ...filters, condition: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas</option>
              {condiciones.attributes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Contador de disponibles */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <p className="text-gray-600">
            Total disponibles: <strong>{canastillasNoSeleccionadas.length}</strong>
            {hayFiltrosActivos && (
              <span className="ml-2">
                | Con filtros: <strong className="text-primary-600">{canastillasFiltradas.length}</strong>
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Vista previa de canastilla ejemplo */}
      {canastillaEjemplo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Vista previa del lote a seleccionar
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-blue-600">Código ejemplo:</span>
                  <span className="ml-1 font-medium text-blue-900">{canastillaEjemplo.codigo}</span>
                </div>
                <div>
                  <span className="text-blue-600">Tamaño:</span>
                  <span className="ml-1 font-medium text-blue-900">{canastillaEjemplo.size || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-blue-600">Color:</span>
                  <span className="ml-1 font-medium text-blue-900">{canastillaEjemplo.color || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-blue-600">Forma:</span>
                  <span className="ml-1 font-medium text-blue-900">{canastillaEjemplo.shape || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-blue-600">Ubicación:</span>
                  <span className="ml-1 font-medium text-blue-900">{canastillaEjemplo.current_location || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-blue-600">Condición:</span>
                  <span className="ml-1 font-medium text-blue-900">{canastillaEjemplo.condition || 'N/A'}</span>
                </div>
              </div>
              <p className="text-xs text-blue-700 mt-2 italic">
                Se tomarán {Math.min(cantidadLote, canastillasFiltradas.length)} canastillas similares a esta
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No hay canastillas con esos filtros */}
      {!canastillaEjemplo && hayFiltrosActivos && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-orange-800">No hay canastillas con estos filtros</p>
              <p className="text-xs text-orange-700 mt-1">Prueba ajustando los filtros para encontrar canastillas disponibles.</p>
            </div>
          </div>
        </div>
      )}

      {/* Cantidad y botón agregar */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Cantidad a agregar
          </label>
          <input
            type="number"
            min="1"
            max={canastillasFiltradas.length || 1}
            value={cantidadLote}
            onChange={(e) => setCantidadLote(e.target.value)}
            placeholder="1"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          type="button"
          onClick={agregarLote}
          disabled={canastillasFiltradas.length === 0}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Agregar Lote
        </button>
      </div>

      {/* Lotes agregados */}
      {lotes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Lotes Agregados</h3>
            <span className="text-sm font-bold text-primary-600">{totalCanastillas} total</span>
          </div>
          <div className="space-y-2">
            {lotes.map(lote => (
              <div key={lote.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {lote.size} | {lote.color} | {lote.shape}
                  </p>
                  <p className="text-xs text-gray-600">
                    Ubicación: {lote.ubicacion} • Cantidad: <strong>{lote.cantidad}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => eliminarLote(lote.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Eliminar lote"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
