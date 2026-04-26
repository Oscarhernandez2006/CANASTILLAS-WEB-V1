/**
 * @module ClientesPage
 * @description CRUD de clientes y puntos de venta.
 */
import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { CrearClienteModal } from '@/components/CrearClienteModal'
import { useSalePoints } from '@/hooks/useSalePoints'
import { useAuthStore } from '@/store/authStore'
import { activateSalePoint, deactivateSalePoint } from '@/services/salePointService'
import { logAuditEvent } from '@/services/auditService'
import { formatDate } from '@/utils/helpers'
import type { SalePoint } from '@/types'

export function ClientesPage() {
  const [showCrearModal, setShowCrearModal] = useState(false)
  const [clienteEditar, setClienteEditar] = useState<SalePoint | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  
  const { salePoints, loading, refreshSalePoints } = useSalePoints()
  const { user: currentUser } = useAuthStore()

  const isSuperAdmin = currentUser?.role === 'super_admin'

  const handleEdit = (cliente: SalePoint) => {
    setClienteEditar(cliente)
    setShowCrearModal(true)
  }

  const handleCloseModal = () => {
    setShowCrearModal(false)
    setClienteEditar(null)
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const targetCliente = salePoints.find(c => c.id === id)
    try {
      if (currentStatus) {
        await deactivateSalePoint(id)
        alert('✅ Cliente desactivado exitosamente')
      } else {
        await activateSalePoint(id)
        alert('✅ Cliente activado exitosamente')
      }
      if (currentUser) {
        await logAuditEvent({
          userId: currentUser.id,
          userName: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
          userRole: currentUser.role,
          action: 'UPDATE',
          module: 'clientes',
          description: `${currentStatus ? 'Desactivación' : 'Activación'} de cliente: ${targetCliente?.name || ''}`,
          details: { cliente_id: id, accion: currentStatus ? 'desactivar' : 'activar', nombre: targetCliente?.name },
        })
      }
      refreshSalePoints()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    }
  }

  const filteredClientes = salePoints.filter((cliente) => {
    const matchesSearch = 
      cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.contact_phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.city.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = 
      filterType === 'all' || 
      cliente.client_type === filterType

    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'active' && cliente.is_active) ||
      (filterStatus === 'inactive' && !cliente.is_active)

    return matchesSearch && matchesType && matchesStatus
  })

  // RESTRICCIÓN: Solo super_admin puede ver esta página
  if (!isSuperAdmin) {
    return (
      <DashboardLayout title="Clientes" subtitle="Gestión de puntos de venta y clientes">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-600">Solo los Super Administradores pueden gestionar clientes.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout 
      title="Clientes" 
      subtitle="Gestión de puntos de venta y clientes externos"
    >
      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white/80">Total clientes</p><p className="text-2xl font-bold mt-1">{salePoints.length}</p></div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white/80">Activos</p><p className="text-2xl font-bold mt-1">{salePoints.filter(c => c.is_active).length}</p></div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white/80">Puntos de venta</p><p className="text-2xl font-bold mt-1">{salePoints.filter(c => c.client_type === 'PUNTO_VENTA').length}</p></div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg></div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-white/80">Clientes externos</p><p className="text-2xl font-bold mt-1">{salePoints.filter(c => c.client_type === 'CLIENTE_EXTERNO').length}</p></div>
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg></div>
            </div>
          </div>
        </div>

        {/* Header con filtros y botón crear */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            {/* Buscador */}
            <div className="sm:col-span-2">
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nombre, código, contacto, teléfono o ciudad..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                />
              </div>
            </div>

            {/* Filtro por tipo */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
            >
              <option value="all">Todos los tipos</option>
              <option value="PUNTO_VENTA">Punto de Venta</option>
              <option value="CLIENTE_EXTERNO">Cliente Externo</option>
            </select>

            {/* Filtro por estado */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>

            {/* Botón crear */}
            <Button onClick={() => setShowCrearModal(true)}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Cliente
            </Button>
          </div>

          {/* Contador */}
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Mostrando <span className="font-semibold text-gray-700 dark:text-gray-200">{filteredClientes.length}</span> de {salePoints.length} clientes
          </div>
        </div>

        {/* Tabla de clientes */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">No se encontraron clientes</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Intenta ajustar los filtros de búsqueda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Ubicación
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Fecha Registro
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredClientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                            <span className="text-primary-600 dark:text-primary-400 font-semibold text-lg">
                              {cliente.client_type === 'PUNTO_VENTA' ? '🏪' : '👤'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {cliente.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{cliente.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          cliente.client_type === 'PUNTO_VENTA' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {cliente.client_type === 'PUNTO_VENTA' ? 'Punto de Venta' : 'Cliente Externo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{cliente.contact_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{cliente.contact_phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{cliente.city}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{cliente.region}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{formatDate(cliente.created_at)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${
                          cliente.is_active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cliente.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          {cliente.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(cliente)}
                            className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggleStatus(cliente.id, cliente.is_active)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              cliente.is_active 
                                ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20' 
                                : 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                            }`}
                          >
                            {cliente.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Crear/Editar Cliente */}
      <CrearClienteModal
        isOpen={showCrearModal}
        onClose={handleCloseModal}
        onSuccess={refreshSalePoints}
        cliente={clienteEditar}
      />
    </DashboardLayout>
  )
}