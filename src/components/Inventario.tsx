import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from './LoadingSpinner'
import { useAuthStore } from '@/store/authStore'

interface LoteItem {
  id: string
  color: string
  size: string
  shape?: string
  condition?: string
  tipoPropiedad: 'PROPIA' | 'ALQUILADA'
  estado: string
  cantidad: number
  canastillas: string[]
}

export function Inventario() {
  const [lotes, setLotes] = useState<LoteItem[]>([])
  const [lotesPaginados, setLotesPaginados] = useState<LoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const { user } = useAuthStore()

  // Estadísticas de canastillas
  const [totalCanastillas, setTotalCanastillas] = useState(0)
  const [canastillasDisponibles, setCanastillasDisponibles] = useState(0)
  const [canastillasEnTraspaso, setCanastillasEnTraspaso] = useState(0)
  const [canastillasEnLavado, setCanastillasEnLavado] = useState(0)

  // Verificar si el usuario es super_admin
  const isSuperAdmin = user?.role === 'super_admin'

  useEffect(() => {
    if (user) {
      cargarInventario()
    }
  }, [user])

  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    setLotesPaginados(lotes.slice(startIndex, endIndex))
  }, [lotes, currentPage])

  const cargarInventario = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!user) return

      // 1. Obtener IDs de canastillas en traspasos PENDIENTES del usuario actual
      let canastillasRetenidas: string[] = []

      if (!isSuperAdmin) {
        const { data: traspasosPendientes, error: errorTraspasos } = await supabase
          .from('transfers')
          .select('id')
          .eq('from_user_id', user.id)
          .eq('status', 'PENDIENTE')

        if (!errorTraspasos && traspasosPendientes && traspasosPendientes.length > 0) {
          const transferIds = traspasosPendientes.map(t => t.id)

          const { data: itemsRetenidos, error: errorItems } = await supabase
            .from('transfer_items')
            .select('canastilla_id')
            .in('transfer_id', transferIds)

          if (!errorItems && itemsRetenidos) {
            canastillasRetenidas = itemsRetenidos.map(item => item.canastilla_id)
          }
        }
      }

      // 2. Cargar TODAS las canastillas usando paginación interna
      // Supabase limita a 1000 filas por consulta, así que cargamos en lotes
      const PAGE_SIZE = 1000
      let allCanastillas: any[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        let canastillasQuery = supabase
          .from('canastillas')
          .select('*')

        // Si NO es super_admin, filtrar solo las canastillas del usuario actual
        if (!isSuperAdmin) {
          canastillasQuery = canastillasQuery.eq('current_owner_id', user.id)
        }

        const { data: canastillas, error: canErr } = await canastillasQuery
          .order('codigo', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (canErr) throw canErr

        if (canastillas && canastillas.length > 0) {
          allCanastillas = [...allCanastillas, ...canastillas]
          offset += PAGE_SIZE
          // Si recibimos menos de PAGE_SIZE, ya no hay más datos
          hasMore = canastillas.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      const canastillas = allCanastillas

      // 3. Calcular estadísticas
      const todasLasCanastillas = canastillas || []
      const totalCount = todasLasCanastillas.length

      // Canastillas con status DISPONIBLE
      const canastillasStatusDisponible = todasLasCanastillas.filter(c => c.status === 'DISPONIBLE')

      // Canastillas con status EN_LAVADO
      const canastillasStatusLavado = todasLasCanastillas.filter(c => c.status === 'EN_LAVADO')
      const enLavadoCount = canastillasStatusLavado.length

      // De las disponibles, cuántas están retenidas en traspasos pendientes
      const retenidasCount = canastillasStatusDisponible.filter(c =>
        canastillasRetenidas.includes(c.id)
      ).length

      // Disponibles reales = status DISPONIBLE y NO retenidas
      const disponiblesCount = canastillasStatusDisponible.length - retenidasCount

      setTotalCanastillas(totalCount)
      setCanastillasEnTraspaso(retenidasCount)
      setCanastillasDisponibles(disponiblesCount)
      setCanastillasEnLavado(enLavadoCount)

      // 4. Filtrar canastillas para lotes (solo las NO retenidas, con status DISPONIBLE)
      const canastillasParaLotes = canastillasStatusDisponible.filter(c =>
        !canastillasRetenidas.includes(c.id)
      )

      // 5. Obtener canastillas dadas de baja (solo para super_admin)
      let bajas: any[] = []
      if (isSuperAdmin) {
        const { data: bajasData, error: bajasErr } = await supabase
          .from('canastillas_bajas')
          .select('*')

        if (bajasErr) throw bajasErr
        bajas = bajasData || []
      }

      // 6. Agrupar por: color + tamaño + forma + condición + tipo_propiedad
      const lotesMap = new Map<string, LoteItem>()

      // PRIMERO: Procesar canastillas disponibles (no retenidas)
      canastillasParaLotes.forEach((c) => {
        const key = `${c.color}|${c.size}|${c.shape || 'SIN_FORMA'}|${c.condition || 'SIN_CONDICION'}|${c.tipo_propiedad}`

        if (!lotesMap.has(key)) {
          lotesMap.set(key, {
            id: key,
            color: c.color,
            size: c.size,
            shape: c.shape || undefined,
            condition: c.condition || undefined,
            tipoPropiedad: c.tipo_propiedad,
            estado: 'DISPONIBLE',
            cantidad: 0,
            canastillas: [],
          })
        }

        const lote = lotesMap.get(key)!
        lote.cantidad += 1
        lote.canastillas.push(c.codigo)
      })

      // SEGUNDO: Procesar canastillas en baja
      bajas?.forEach((b) => {
        const estado = 'DADA_DE_BAJA'
        const key = `${b.color}|${b.size}|${b.shape || 'SIN_FORMA'}|${b.condition || 'SIN_CONDICION'}|${b.tipo_propiedad}|${estado}`

        if (!lotesMap.has(key)) {
          lotesMap.set(key, {
            id: key,
            color: b.color,
            size: b.size,
            shape: b.shape || undefined,
            condition: b.condition || undefined,
            tipoPropiedad: b.tipo_propiedad,
            estado: estado,
            cantidad: 0,
            canastillas: [],
          })
        }

        const lote = lotesMap.get(key)!
        lote.cantidad += 1
        lote.canastillas.push(b.codigo)
      })

      // Convertir a array y ordenar
      let lotesArray: LoteItem[] = Array.from(lotesMap.values()).sort((a, b) => {
        // Primero ordenar por tipo de propiedad
        if (a.tipoPropiedad !== b.tipoPropiedad) {
          return a.tipoPropiedad === 'PROPIA' ? -1 : 1
        }
        // Luego por color
        if (a.color !== b.color) {
          return a.color.localeCompare(b.color)
        }
        // Luego por tamaño
        if (a.size !== b.size) {
          return a.size.localeCompare(b.size)
        }
        // Finalmente por cantidad (mayor primero)
        return b.cantidad - a.cantidad
      })

      setLotes(lotesArray)
      setCurrentPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar inventario')
      console.error('Error cargando inventario:', err)
    } finally {
      setLoading(false)
    }
  }

  const getEstadoLabel = (estado: string): string => {
    const labels: Record<string, string> = {
      'DISPONIBLE': '✅ Disponible',
      'EN_ALQUILER': '🔄 En Alquiler',
      'EN_LAVADO': '🧼 En Lavado',
      'EN_USO_INTERNO': '🏢 Uso Interno',
      'EN_REPARACION': '🔧 Reparación',
      'FUERA_SERVICIO': '⛔ Fuera Servicio',
      'EXTRAVIADA': '❓ Extraviada',
      'DADA_DE_BAJA': '🗑️ Destrucción',
    }
    return labels[estado] || estado
  }

  const getEstadoColor = (estado: string): string => {
    const colors: Record<string, string> = {
      'DISPONIBLE': 'bg-green-50 border-green-200',
      'EN_ALQUILER': 'bg-purple-50 border-purple-200',
      'EN_LAVADO': 'bg-cyan-50 border-cyan-200',
      'EN_USO_INTERNO': 'bg-yellow-50 border-yellow-200',
      'EN_REPARACION': 'bg-orange-50 border-orange-200',
      'FUERA_SERVICIO': 'bg-red-50 border-red-200',
      'EXTRAVIADA': 'bg-red-100 border-red-300',
      'DADA_DE_BAJA': 'bg-gray-300 border-gray-500',
    }
    return colors[estado] || 'bg-gray-50 border-gray-200'
  }

  const getTipoLabel = (tipo: string): string => {
    return tipo === 'PROPIA' ? '🏢 Propia' : '🔄 Alquilada'
  }

  const getTipoColor = (tipo: string): string => {
    return tipo === 'PROPIA' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
  }

  // CALCULAR ESTADÍSTICAS DE LOTES
  const totalEnLotes = lotes
    .filter(l => l.estado !== 'DADA_DE_BAJA')
    .reduce((sum, l) => sum + l.cantidad, 0)
  const enDestruccion = lotes
    .filter(l => l.estado === 'DADA_DE_BAJA')
    .reduce((sum, l) => sum + l.cantidad, 0)

  const totalPages = Math.ceil(lotes.length / itemsPerPage)

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
          {isSuperAdmin ? 'Inventario General' : 'Mi Inventario'}
        </h1>
        <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">
          {isSuperAdmin
            ? 'Todas las canastillas del sistema'
            : 'Tus canastillas agrupadas por características'
          }
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className={`grid grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 sm:gap-4`}>
        <div className="p-3 sm:p-4 lg:p-6 rounded-lg border bg-blue-50 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-gray-600 text-xs sm:text-sm font-medium">Total</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{totalCanastillas}</p>
            <p className="text-xs text-gray-500 mt-1 hidden sm:block">En tu inventario</p>
          </div>
        </div>
        <div className="p-3 sm:p-4 lg:p-6 rounded-lg border bg-green-50 border-green-200 shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-gray-600 text-xs sm:text-sm font-medium">Disponibles</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600 mt-1 sm:mt-2">{canastillasDisponibles}</p>
            <p className="text-xs text-gray-500 mt-1 hidden sm:block">Libres para usar</p>
          </div>
        </div>
        <div className="p-3 sm:p-4 lg:p-6 rounded-lg border bg-amber-50 border-amber-200 shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-gray-600 text-xs sm:text-sm font-medium">En Traspaso</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-600 mt-1 sm:mt-2">{canastillasEnTraspaso}</p>
            <p className="text-xs text-gray-500 mt-1 hidden sm:block">Pendientes</p>
          </div>
        </div>
        <div className="p-3 sm:p-4 lg:p-6 rounded-lg border bg-cyan-50 border-cyan-200 shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-gray-600 text-xs sm:text-sm font-medium">En Lavado</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-cyan-600 mt-1 sm:mt-2">{canastillasEnLavado}</p>
            <p className="text-xs text-gray-500 mt-1 hidden sm:block">En proceso</p>
          </div>
        </div>
        {isSuperAdmin && (
          <div className="p-3 sm:p-4 lg:p-6 rounded-lg border bg-gray-300 border-gray-500 shadow-sm hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
            <div>
              <p className="text-gray-700 text-xs sm:text-sm font-medium">Destrucción</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{enDestruccion}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Lotes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Lotes Disponibles</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {lotes.length} lotes ({totalEnLotes} canastillas)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Color</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tamaño</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Forma</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Condición</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lotesPaginados.length > 0 ? (
                lotesPaginados.map((lote) => (
                  <tr key={lote.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getTipoColor(lote.tipoPropiedad)}`}>
                        {getTipoLabel(lote.tipoPropiedad)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{
                            backgroundColor: lote.color.toLowerCase().replace(/ /g, ''),
                          }}
                        />
                        <span className="text-sm font-medium text-gray-900">{lote.color}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{lote.size}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{lote.shape || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{lote.condition || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
                        {lote.cantidad}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="font-medium">No hay lotes para mostrar</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col items-center gap-3">
          <div className="text-xs sm:text-sm text-gray-600 text-center">
            {lotesPaginados.length === 0 ? 0 : Math.min((currentPage - 1) * itemsPerPage + 1, lotes.length)}-
            {Math.min(currentPage * itemsPerPage, lotes.length)} de {lotes.length} lotes
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2 sm:px-4 py-1 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-medium"
              >
                <span className="hidden sm:inline">← Anterior</span>
                <span className="sm:hidden">←</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page =>
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  )
                  .map((page, idx, arr) => {
                    if (idx > 0 && arr[idx - 1] !== page - 1) {
                      return (
                        <span key={`dots-${page}`} className="px-1 sm:px-2 text-gray-500 text-xs">
                          ...
                        </span>
                      )
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium ${
                          currentPage === page
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2 sm:px-4 py-1 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-medium"
              >
                <span className="hidden sm:inline">Siguiente →</span>
                <span className="sm:hidden">→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}