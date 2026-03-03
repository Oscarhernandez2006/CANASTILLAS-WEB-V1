import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { GestionarPermisosModal } from '@/components/GestionarPermisosModal'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

const ROLE_LABELS: { [key: string]: string } = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  logistics: 'Logística',
  operator: 'Operador',
  washing_staff: 'Personal de Lavado',
  client: 'Cliente',
}

const ROLE_COLORS: { [key: string]: string } = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  supervisor: 'bg-green-100 text-green-800',
  logistics: 'bg-yellow-100 text-yellow-800',
  operator: 'bg-gray-100 text-gray-800',
  washing_staff: 'bg-cyan-100 text-cyan-800',
  client: 'bg-pink-100 text-pink-800',
}

export function PermisosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showPermisosModal, setShowPermisosModal] = useState(false)

  const { users, loading } = useUsers()
  const { user: currentUser } = useAuthStore()

  const isSuperAdmin = currentUser?.role === 'super_admin'

  const handleGestionarPermisos = (user: User) => {
    setSelectedUser(user)
    setShowPermisosModal(true)
  }

  const handleCloseModal = () => {
    setShowPermisosModal(false)
    setSelectedUser(null)
  }

  // Filtrar usuarios (excluir super_admin y clientes)
  const filteredUsers = users.filter((user) => {
    // No mostrar super_admin ni clientes
    if (user.role === 'super_admin' || user.role === 'client') return false

    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole = filterRole === 'all' || user.role === filterRole

    return matchesSearch && matchesRole
  })

  if (!isSuperAdmin) {
    return (
      <DashboardLayout title="Permisos" subtitle="Gestión de permisos por usuario">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-600">Solo los Super Administradores pueden gestionar permisos.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Permisos" subtitle="Gestión de permisos por usuario">
      <div className="space-y-6">
        {/* Info Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 px-4 py-3 rounded-r-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm">
              <strong>Nota:</strong> Asigna permisos específicos a cada usuario. Los usuarios nuevos no tienen permisos hasta que se los asignes. El Super Admin siempre tiene acceso total.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[250px]">
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="logistics">Logística</option>
              <option value="operator">Operador</option>
              <option value="washing_staff">Personal de Lavado</option>
            </select>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Mostrando {filteredUsers.length} de {users.filter(u => u.role !== 'super_admin' && u.role !== 'client').length} usuarios
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Estado</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        <span className="ml-3 text-gray-600">Cargando usuarios...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-semibold">
                              {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleGestionarPermisos(user)}
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Gestionar Permisos
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="font-medium">No se encontraron usuarios</p>
                        <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Gestión de Permisos */}
      {selectedUser && (
        <GestionarPermisosModal
          isOpen={showPermisosModal}
          onClose={handleCloseModal}
          user={selectedUser}
        />
      )}
    </DashboardLayout>
  )
}
