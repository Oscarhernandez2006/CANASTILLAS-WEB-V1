import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { CrearClienteModal } from '@/components/CrearClienteModal'
import { useSalePoints } from '@/hooks/useSalePoints'
import { useAuthStore } from '@/store/authStore'
import { activateSalePoint, deactivateSalePoint } from '@/services/salePointService'
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
    try {
      if (currentStatus) {
        await deactivateSalePoint(id)
        alert('✅ Cliente desactivado exitosamente')
      } else {
        await activateSalePoint(id)
        alert('✅ Cliente activado exitosamente')
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
        {/* Header con filtros y botón crear */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Buscador */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nombre, código, contacto, teléfono o ciudad..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Filtro por tipo */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Todos los tipos</option>
              <option value="PUNTO_VENTA">Punto de Venta</option>
              <option value="CLIENTE_EXTERNO">Cliente Externo</option>
            </select>

            {/* Filtro por estado */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <div className="mt-4 text-sm text-gray-600">
            Mostrando {filteredClientes.length} de {salePoints.length} clientes
          </div>
        </div>

        {/* Tabla de clientes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-900">No se encontraron clientes</p>
              <p className="text-sm text-gray-500 mt-1">Intenta ajustar los filtros de búsqueda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ubicación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Registro
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredClientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-semibold text-lg">
                              {cliente.client_type === 'PUNTO_VENTA' ? '🏪' : '👤'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {cliente.name}
                            </div>
                            <div className="text-sm text-gray-500">{cliente.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          cliente.client_type === 'PUNTO_VENTA' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {cliente.client_type === 'PUNTO_VENTA' ? 'Punto de Venta' : 'Cliente Externo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{cliente.contact_name}</div>
                        <div className="text-sm text-gray-500">{cliente.contact_phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{cliente.city}</div>
                        <div className="text-sm text-gray-500">{cliente.region}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(cliente.created_at)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          cliente.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {cliente.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button
                          onClick={() => handleEdit(cliente)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleStatus(cliente.id, cliente.is_active)}
                          className={
                            cliente.is_active 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }
                        >
                          {cliente.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Clientes</span>
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{salePoints.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-green-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-600">Puntos de Venta</span>
              <span className="text-2xl">🏪</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {salePoints.filter(c => c.client_type === 'PUNTO_VENTA').length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-600">Clientes Externos</span>
              <span className="text-2xl">👤</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {salePoints.filter(c => c.client_type === 'CLIENTE_EXTERNO').length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Activos</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {salePoints.filter(c => c.is_active).length}
            </p>
          </div>
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