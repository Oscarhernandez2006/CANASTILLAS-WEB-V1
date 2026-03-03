import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/utils/helpers'

interface ClienteConCanastillas {
  rental_id: string
  cliente: {
    id: string
    name: string
    contact_name: string
    contact_phone: string
    city: string
  }
  canastillas: Array<{
    id: string
    codigo: string
    size: string
    color: string
    qr_code: string
  }>
  fecha_inicio: string
  dias_transcurridos: number
  fecha_estimada_retorno: string | null
  total_canastillas: number
}

export function CanastillasPorCliente() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<ClienteConCanastillas[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null)

  useEffect(() => {
    fetchCanastillasPorCliente()
  }, [user])

  const fetchCanastillasPorCliente = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Obtener todos los alquileres activos del usuario
      const { data: rentals, error } = await supabase
        .from('rentals')
        .select(`
          id,
          start_date,
          estimated_return_date,
          sale_point:sale_points(
            id,
            name,
            contact_name,
            contact_phone,
            city
          ),
          rental_items(
            canastilla:canastillas(
              id,
              codigo,
              size,
              color,
              qr_code
            )
          )
        `)
        .eq('status', 'ACTIVO')
        .eq('created_by', user.id)
        .order('start_date', { ascending: false })

      if (error) throw error

      // Transformar datos
      const clientesData: ClienteConCanastillas[] = rentals?.map((rental: any) => {
        const diasTranscurridos = Math.floor(
          (new Date().getTime() - new Date(rental.start_date).getTime()) / (1000 * 60 * 60 * 24)
        )

        return {
          rental_id: rental.id,
          cliente: rental.sale_point,
          canastillas: rental.rental_items.map((item: any) => item.canastilla),
          fecha_inicio: rental.start_date,
          dias_transcurridos: diasTranscurridos,
          fecha_estimada_retorno: rental.estimated_return_date,
          total_canastillas: rental.rental_items.length,
        }
      }) || []

      setClientes(clientesData)
    } catch (error) {
      console.error('Error fetching canastillas por cliente:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredClientes = clientes.filter((cliente) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      cliente.cliente.name.toLowerCase().includes(searchLower) ||
      cliente.cliente.contact_name.toLowerCase().includes(searchLower) ||
      cliente.cliente.city.toLowerCase().includes(searchLower)
    )
  })

  const toggleExpand = (rentalId: string) => {
    setExpandedCliente(expandedCliente === rentalId ? null : rentalId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (clientes.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-lg font-medium text-gray-900">No hay canastillas en alquiler</p>
        <p className="text-sm text-gray-500 mt-1">Crea un alquiler para ver las canastillas en poder de clientes</p>
      </div>
    )
  }

  const totalCanastillas = clientes.reduce((sum, c) => sum + c.total_canastillas, 0)

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Clientes Activos</p>
              <p className="text-2xl font-bold text-gray-900">{clientes.length}</p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Canastillas en Alquiler</p>
              <p className="text-2xl font-bold text-blue-600">{totalCanastillas}</p>
            </div>
            <div className="text-3xl">📦</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-yellow-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Días Promedio</p>
              <p className="text-2xl font-bold text-yellow-600">
                {Math.round(clientes.reduce((sum, c) => sum + c.dias_transcurridos, 0) / clientes.length)}
              </p>
            </div>
            <div className="text-3xl">📅</div>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Buscar por cliente, contacto o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Lista de clientes con canastillas */}
      <div className="space-y-4">
        {filteredClientes.map((cliente) => (
          <div key={cliente.rental_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header del cliente */}
            <div
              className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleExpand(cliente.rental_id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{cliente.cliente.name}</h3>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {cliente.total_canastillas} canastilla{cliente.total_canastillas !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>{cliente.cliente.contact_name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{cliente.cliente.contact_phone}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{cliente.cliente.city}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 mt-3 text-sm">
                    <div className="flex items-center space-x-1 text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Desde: {formatDate(cliente.fecha_inicio)}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-yellow-600 font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{cliente.dias_transcurridos} día{cliente.dias_transcurridos !== 1 ? 's' : ''}</span>
                    </div>
                    {cliente.fecha_estimada_retorno && (
                      <div className="flex items-center space-x-1 text-gray-600">
                        <span>Est. retorno: {formatDate(cliente.fecha_estimada_retorno)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-4">
                  <svg
                    className={`w-6 h-6 text-gray-400 transition-transform ${
                      expandedCliente === cliente.rental_id ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Lista expandible de canastillas */}
            {expandedCliente === cliente.rental_id && (
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Canastillas en poder del cliente:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cliente.canastillas.map((canastilla) => (
                    <div
                      key={canastilla.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-900">{canastilla.codigo}</span>
                        <span className="text-xs text-gray-500">{canastilla.qr_code}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-600">
                        <span className="px-2 py-1 bg-gray-100 rounded">{canastilla.size}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded">{canastilla.color}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}