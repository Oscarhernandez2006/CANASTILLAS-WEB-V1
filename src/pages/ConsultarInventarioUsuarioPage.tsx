/** @module ConsultarInventarioUsuarioPage @description Consulta del inventario de canastillas por usuario, agrupado por lotes. */
import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { SearchableUserSelect } from '@/components/SearchableUserSelect'
import { supabase } from '@/lib/supabase'
import type { User, Canastilla } from '@/types'

interface LoteGroup {
  key: string
  size: string
  color: string
  shape: string
  condition: string
  tipo_propiedad: string
  cantidad: number
  canastillas: Canastilla[]
}

interface UserInfo {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string | null
  role: string
  department?: string | null
  area?: string | null
  is_active: boolean
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  operator: 'Operador',
  washing_staff: 'Lavado',
  logistics: 'Logística',
  conductor: 'Conductor',
  pdv: 'Punto de Venta',
  client: 'Cliente',
}

const STATUS_LABELS: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  EN_ALQUILER: 'En Alquiler',
  EN_LAVADO: 'En Lavado',
  EN_USO_INTERNO: 'Uso Interno',
  EN_REPARACION: 'En Reparación',
  EN_RETORNO: 'En Retorno',
  DADA_DE_BAJA: 'Dada de Baja',
  EXTRAVIADA: 'Extraviada',
  PERDIDA: 'Perdida',
}

const STATUS_COLORS: Record<string, string> = {
  DISPONIBLE: 'bg-green-100 text-green-800',
  EN_ALQUILER: 'bg-blue-100 text-blue-800',
  EN_LAVADO: 'bg-yellow-100 text-yellow-800',
  EN_USO_INTERNO: 'bg-purple-100 text-purple-800',
  EN_REPARACION: 'bg-orange-100 text-orange-800',
  EN_RETORNO: 'bg-cyan-100 text-cyan-800',
  DADA_DE_BAJA: 'bg-red-100 text-red-800',
  EXTRAVIADA: 'bg-gray-100 text-gray-800',
  PERDIDA: 'bg-red-100 text-red-800',
}

export function ConsultarInventarioUsuarioPage() {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null)
  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [allCanastillas, setAllCanastillas] = useState<Canastilla[]>([])
  const [loadingCanastillas, setLoadingCanastillas] = useState(false)
  const [expandedLote, setExpandedLote] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find(u => u.id === selectedUserId)
      setSelectedUser(user || null)
      fetchCanastillasUsuario(selectedUserId)
    } else {
      setSelectedUser(null)
      setLotes([])
      setAllCanastillas([])
    }
  }, [selectedUserId, users])

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)

      const [usersRes, salePointsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, email, first_name, last_name, phone, role, department, area, is_active, created_at')
          .eq('is_active', true)
          .order('first_name'),
        supabase
          .from('sale_points')
          .select('id, name, contact_name, contact_phone, address, city')
          .eq('is_active', true)
          .order('name'),
      ])

      if (usersRes.error) throw usersRes.error

      const normalUsers = usersRes.data || []

      // Crear pseudo-usuarios para clientes externos
      const clientUsers: UserInfo[] = (salePointsRes.data || []).map(sp => ({
        id: `client_${sp.id}`,
        email: sp.contact_phone || 'Cliente externo',
        first_name: '🏢',
        last_name: sp.name,
        phone: sp.contact_phone || null,
        role: 'client',
        department: sp.address || null,
        area: sp.city || null,
        is_active: true,
        created_at: '',
      }))

      setUsers([...normalUsers, ...clientUsers])
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const fetchCanastillasUsuario = async (userId: string) => {
    setLoadingCanastillas(true)
    setLotes([])
    setAllCanastillas([])
    setExpandedLote(null)

    try {
      const PAGE_SIZE = 1000
      let canastillas: Canastilla[] = []

      const isClient = userId.startsWith('client_')

      if (isClient) {
        const salePointId = userId.replace('client_', '')

        // 1. Obtener nombre del cliente
        const { data: sp } = await supabase
          .from('sale_points')
          .select('name')
          .eq('id', salePointId)
          .single()
        const clientName = sp?.name || ''

        // 2. Buscar por current_location (canastillas de alquiler)
        let offset = 0
        let hasMore = true
        while (hasMore) {
          const { data, error } = await supabase
            .from('canastillas')
            .select('id, codigo, size, color, shape, status, condition, tipo_propiedad, current_location, current_owner_id')
            .eq('current_location', clientName)
            .order('color', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1)
          if (error) throw error
          if (data && data.length > 0) {
            canastillas = [...canastillas, ...data]
            offset += PAGE_SIZE
            hasMore = data.length === PAGE_SIZE
          } else {
            hasMore = false
          }
        }

        // 3. Buscar por traspasos externos: obtener el usuario virtual del cliente
        const { data: transfers } = await supabase
          .from('transfers')
          .select('to_user_id')
          .eq('sale_point_id', salePointId)
          .eq('is_external_transfer', true)
          .not('to_user_id', 'is', null)

        if (transfers && transfers.length > 0) {
          const externalUserIds = [...new Set(transfers.map(t => t.to_user_id))]
          for (const extUserId of externalUserIds) {
            offset = 0
            hasMore = true
            while (hasMore) {
              const { data, error } = await supabase
                .from('canastillas')
                .select('id, codigo, size, color, shape, status, condition, tipo_propiedad, current_location, current_owner_id')
                .eq('current_owner_id', extUserId)
                .order('color', { ascending: true })
                .order('id', { ascending: true })
                .range(offset, offset + PAGE_SIZE - 1)
              if (error) throw error
              if (data && data.length > 0) {
                canastillas = [...canastillas, ...data]
                offset += PAGE_SIZE
                hasMore = data.length === PAGE_SIZE
              } else {
                hasMore = false
              }
            }
          }
        }

        // Eliminar duplicados por id
        const uniqueMap = new Map(canastillas.map(c => [c.id, c]))
        canastillas = Array.from(uniqueMap.values())

      } else {
        // Usuario normal: buscar por current_owner_id
        let offset = 0
        let hasMore = true
        while (hasMore) {
          const { data, error } = await supabase
            .from('canastillas')
            .select('id, codigo, size, color, shape, status, condition, tipo_propiedad, current_location, current_owner_id')
            .eq('current_owner_id', userId)
            .order('color', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1)
          if (error) throw error
          if (data && data.length > 0) {
            canastillas = [...canastillas, ...data]
            offset += PAGE_SIZE
            hasMore = data.length === PAGE_SIZE
          } else {
            hasMore = false
          }
        }
      }

      setAllCanastillas(canastillas)
      agruparEnLotes(canastillas)
    } catch (err) {
      console.error('Error fetching canastillas:', err)
    } finally {
      setLoadingCanastillas(false)
    }
  }

  const agruparEnLotes = (canastillas: Canastilla[], statusFilter = 'all') => {
    const filtered = statusFilter === 'all'
      ? canastillas
      : canastillas.filter(c => c.status === statusFilter)

    const grouped: Record<string, LoteGroup> = {}

    for (const c of filtered) {
      const key = `${c.size}-${c.color}-${c.shape || 'N/A'}-${c.condition || 'N/A'}-${c.tipo_propiedad || 'PROPIA'}-${c.status}`

      if (!grouped[key]) {
        grouped[key] = {
          key,
          size: c.size,
          color: c.color,
          shape: c.shape || 'N/A',
          condition: c.condition || 'N/A',
          tipo_propiedad: c.tipo_propiedad || 'PROPIA',
          cantidad: 0,
          canastillas: [],
        }
      }

      grouped[key].cantidad++
      grouped[key].canastillas.push(c)
    }

    const sorted = Object.values(grouped).sort((a, b) => {
      const statusOrder = a.canastillas[0]?.status.localeCompare(b.canastillas[0]?.status) || 0
      if (statusOrder !== 0) return statusOrder
      const sizeCompare = a.size.localeCompare(b.size)
      if (sizeCompare !== 0) return sizeCompare
      return a.color.localeCompare(b.color)
    })

    setLotes(sorted)
  }

  const handleFilterChange = (status: string) => {
    setFilterStatus(status)
    agruparEnLotes(allCanastillas, status)
  }

  // Resumen por estado
  const resumenPorEstado = allCanastillas.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})

  // Resumen por ubicación
  const resumenPorUbicacion = allCanastillas.reduce<Record<string, number>>((acc, c) => {
    const loc = c.current_location || 'Sin ubicación'
    acc[loc] = (acc[loc] || 0) + 1
    return acc
  }, {})

  return (
    <DashboardLayout title="Consultar Inventario por Usuario" subtitle="Seleccione un usuario para ver su inventario">
      <div className="space-y-6">
        {/* Selector de usuario */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Seleccionar Usuario</label>
          {loadingUsers ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-3">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando usuarios...
            </div>
          ) : (
            <SearchableUserSelect
              users={users}
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="Buscar usuario por nombre o correo..."
            />
          )}
        </div>

        {/* Información del usuario */}
        {selectedUser && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Información del Usuario
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Nombre</p>
                <p className="text-sm font-medium text-gray-900">{selectedUser.first_name} {selectedUser.last_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Correo</p>
                <p className="text-sm font-medium text-gray-900">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Teléfono</p>
                <p className="text-sm font-medium text-gray-900">{selectedUser.phone || 'No registrado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Rol</p>
                <p className="text-sm font-medium text-gray-900">{ROLE_LABELS[selectedUser.role] || selectedUser.role}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Departamento / Ubicación</p>
                <p className="text-sm font-medium text-gray-900">{selectedUser.department || 'No asignado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Área</p>
                <p className="text-sm font-medium text-gray-900">{selectedUser.area || 'No asignada'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loadingCanastillas && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col items-center gap-3">
            <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-500">Cargando inventario...</p>
          </div>
        )}

        {/* Resumen del inventario */}
        {selectedUser && !loadingCanastillas && allCanastillas.length > 0 && (
          <>
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{allCanastillas.length}</p>
                <p className="text-xs text-gray-500 mt-1">Total Canastillas</p>
              </div>
              {Object.entries(resumenPorEstado).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                <div
                  key={status}
                  onClick={() => handleFilterChange(filterStatus === status ? 'all' : status)}
                  className={`bg-white rounded-xl shadow-sm border-2 p-4 text-center cursor-pointer transition-all hover:shadow-md ${
                    filterStatus === status ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200'
                  }`}
                >
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 mt-1">{STATUS_LABELS[status] || status}</p>
                </div>
              ))}
            </div>

            {/* Resumen por ubicación */}
            {Object.keys(resumenPorUbicacion).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Distribución por Ubicación
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(resumenPorUbicacion).sort((a, b) => b[1] - a[1]).map(([loc, count]) => (
                    <span key={loc} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm">
                      <span className="font-medium">{loc}</span>
                      <span className="bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full text-xs font-bold">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Filtro activo */}
            {filterStatus !== 'all' && (
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[filterStatus] || 'bg-gray-100 text-gray-800'}`}>
                  Filtrando: {STATUS_LABELS[filterStatus] || filterStatus}
                </span>
                <button onClick={() => handleFilterChange('all')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  Limpiar filtro
                </button>
              </div>
            )}

            {/* Lotes */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Canastillas por Lotes ({lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'})
              </h3>
              {lotes.map((lote) => {
                const status = lote.canastillas[0]?.status || 'DISPONIBLE'
                return (
                  <div key={lote.key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedLote(expandedLote === lote.key ? null : lote.key)}
                      className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: lote.color.toLowerCase() }}
                            title={lote.color}
                          />
                          <span className="font-semibold text-gray-900">{lote.size}</span>
                          <span className="text-gray-500">·</span>
                          <span className="text-gray-700">{lote.color}</span>
                        </div>
                        {lote.shape !== 'N/A' && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{lote.shape}</span>
                        )}
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{lote.tipo_propiedad}</span>
                        {lote.condition !== 'N/A' && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{lote.condition}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
                          {STATUS_LABELS[status] || status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-bold">
                          {lote.cantidad}
                        </span>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${expandedLote === lote.key ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedLote === lote.key && (
                      <div className="border-t border-gray-200 px-4 sm:px-6 py-3 bg-gray-50">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                                <th className="pb-2 pr-4">Código</th>
                                <th className="pb-2 pr-4">Ubicación</th>
                                <th className="pb-2 pr-4">Área</th>
                                <th className="pb-2 pr-4">Estado</th>
                                <th className="pb-2">Creada</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {lote.canastillas.map((c) => (
                                <tr key={c.id} className="hover:bg-white transition-colors">
                                  <td className="py-2 pr-4 font-mono text-xs text-gray-900">{c.codigo}</td>
                                  <td className="py-2 pr-4 text-gray-600">{c.current_location || '—'}</td>
                                  <td className="py-2 pr-4 text-gray-600">{c.current_area || '—'}</td>
                                  <td className="py-2 pr-4">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100'}`}>
                                      {STATUS_LABELS[c.status] || c.status}
                                    </span>
                                  </td>
                                  <td className="py-2 text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString('es-CO')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Sin canastillas */}
        {selectedUser && !loadingCanastillas && allCanastillas.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-gray-500 font-medium">Este usuario no tiene canastillas asignadas</p>
            <p className="text-gray-400 text-sm mt-1">Las canastillas aparecerán cuando se le asignen al usuario</p>
          </div>
        )}

        {/* Sin selección */}
        {!selectedUser && !loadingUsers && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-gray-500 font-medium">Seleccione un usuario para consultar su inventario</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
