import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Canastilla } from '@/types'

interface CanastillaConAlquiler extends Canastilla {
  alquiler?: {
    cliente: string
    dias_transcurridos: number
    fecha_inicio: string
  }
}

export function InventarioDetallado() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [canastillas, setCanastillas] = useState<CanastillaConAlquiler[]>([])

  useEffect(() => {
    fetchCanastillas()
  }, [user])

  const fetchCanastillas = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Cargar TODAS las canastillas usando paginación interna
      const PAGE_SIZE = 1000
      let allCanastillas: Canastilla[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error: canastillasError } = await supabase
          .from('canastillas')
          .select('*')
          .eq('current_owner_id', user.id)
          .order('status')
          .order('codigo')
          .range(offset, offset + PAGE_SIZE - 1)

        if (canastillasError) throw canastillasError

        if (data && data.length > 0) {
          allCanastillas = [...allCanastillas, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      const canastillasData = allCanastillas

      // Obtener alquileres activos con sus canastillas
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('rentals')
        .select(`
          id,
          start_date,
          sale_point:sale_points(name),
          rental_items(canastilla_id)
        `)
        .eq('status', 'ACTIVO')
        .eq('created_by', user.id)

      if (rentalsError) throw rentalsError

      // Crear un mapa de canastillas en alquiler
      const canastillasEnAlquilerMap = new Map()
      
      rentalsData?.forEach((rental: any) => {
        rental.rental_items?.forEach((item: any) => {
          const diasTranscurridos = Math.floor(
            (new Date().getTime() - new Date(rental.start_date).getTime()) / (1000 * 60 * 60 * 24)
          )
          
          canastillasEnAlquilerMap.set(item.canastilla_id, {
            cliente: rental.sale_point?.name || 'Cliente desconocido',
            dias_transcurridos: diasTranscurridos,
            fecha_inicio: rental.start_date,
          })
        })
      })

      // Combinar datos
      const canastillasConInfo = canastillasData?.map((canastilla) => ({
        ...canastilla,
        alquiler: canastillasEnAlquilerMap.get(canastilla.id),
      })) || []

      setCanastillas(canastillasConInfo)
    } catch (error) {
      console.error('Error fetching canastillas:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const disponibles = canastillas.filter(c => c.status === 'DISPONIBLE')
  const enAlquiler = canastillas.filter(c => c.status === 'EN_ALQUILER')
  const enTraspaso = canastillas.filter(c => c.status === 'EN_TRASPASO')
  const otras = canastillas.filter(c => !['DISPONIBLE', 'EN_ALQUILER', 'EN_TRASPASO'].includes(c.status))

  // Agrupar canastillas en alquiler por cliente
  const canastillasPorCliente = enAlquiler.reduce((acc, canastilla) => {
    const cliente = canastilla.alquiler?.cliente || 'Sin cliente'
    if (!acc[cliente]) {
      acc[cliente] = []
    }
    acc[cliente].push(canastilla)
    return acc
  }, {} as Record<string, CanastillaConAlquiler[]>)

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{canastillas.length}</p>
            </div>
            <div className="text-3xl">📦</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-green-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Disponibles</p>
              <p className="text-2xl font-bold text-green-600">{disponibles.length}</p>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">En Alquiler</p>
              <p className="text-2xl font-bold text-blue-600">{enAlquiler.length}</p>
            </div>
            <div className="text-3xl">🔒</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-yellow-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">En Traspaso</p>
              <p className="text-2xl font-bold text-yellow-600">{enTraspaso.length}</p>
            </div>
            <div className="text-3xl">⏳</div>
          </div>
        </div>
      </div>

      {/* Canastillas DISPONIBLES para traspaso */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            ✅ Canastillas Disponibles para Traspaso
          </h3>
          <span className="text-sm text-gray-600">{disponibles.length} canastillas</span>
        </div>
        
        {disponibles.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No tienes canastillas disponibles</p>
        ) : (
          <div className="text-sm text-gray-600">
            Estas canastillas están disponibles y puedes traspasarlas o alquilarlas.
          </div>
        )}
      </div>

      {/* Canastillas EN ALQUILER (agrupadas por cliente) */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            🔒 Canastillas en Alquiler (No Disponibles)
          </h3>
          <span className="text-sm text-gray-600">{enAlquiler.length} canastillas</span>
        </div>

        {enAlquiler.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No tienes canastillas en alquiler</p>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
              <p className="text-sm text-blue-900">
                <strong>⚠️ Importante:</strong> Estas canastillas están en poder de clientes y NO puedes traspasarlas hasta que sean devueltas.
              </p>
            </div>

            {Object.entries(canastillasPorCliente).map(([cliente, canastillasCliente]) => {
              const diasPromedio = Math.round(
                canastillasCliente.reduce((sum, c) => sum + (c.alquiler?.dias_transcurridos || 0), 0) / canastillasCliente.length
              )

              return (
                <div key={cliente} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{cliente}</h4>
                      <p className="text-sm text-gray-600">
                        {canastillasCliente.length} canastilla{canastillasCliente.length !== 1 ? 's' : ''} • Hace {diasPromedio} día{diasPromedio !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      En Alquiler
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {canastillasCliente.slice(0, 8).map((canastilla) => (
                      <div key={canastilla.id} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                        {canastilla.codigo}
                      </div>
                    ))}
                    {canastillasCliente.length > 8 && (
                      <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded flex items-center justify-center">
                        +{canastillasCliente.length - 8} más
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Canastillas EN TRASPASO */}
      {enTraspaso.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-yellow-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              ⏳ Canastillas en Traspaso Pendiente
            </h3>
            <span className="text-sm text-gray-600">{enTraspaso.length} canastillas</span>
          </div>
          <p className="text-sm text-gray-600">
            Estas canastillas están esperando aprobación de traspaso.
          </p>
        </div>
      )}

      {/* Otras canastillas */}
      {otras.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              📋 Otras Canastillas
            </h3>
            <span className="text-sm text-gray-600">{otras.length} canastillas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {otras.map((canastilla) => (
              <span key={canastilla.id} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                {canastilla.codigo} - {canastilla.status}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}