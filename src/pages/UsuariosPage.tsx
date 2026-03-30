import { useState } from 'react'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Button } from '@/components/Button'
import { CrearUsuarioModal } from '@/components/CrearUsuarioModal'
import { EditarUsuarioModal } from '@/components/EditarUsuarioModal'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { updateUser, activateUser, deactivateUser, adminChangeUserPassword, deleteUserCompletely } from '@/services/userService'
import { formatDate } from '@/utils/helpers'
import { validatePassword } from '@/utils/security'

const ROLE_LABELS: { [key: string]: string } = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  logistics: 'Logística',
  conductor: 'Conductor',
  pdv: 'PDV',
  operator: 'Operador',
  washing_staff: 'Personal de Lavado',
  client: 'Cliente',
}

const ROLE_COLORS: { [key: string]: string } = {
  super_admin: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  supervisor: 'bg-green-100 text-green-800',
  logistics: 'bg-yellow-100 text-yellow-800',
  conductor: 'bg-orange-100 text-orange-800',
  pdv: 'bg-rose-100 text-rose-800',
  operator: 'bg-gray-100 text-gray-800',
  washing_staff: 'bg-cyan-100 text-cyan-800',
  client: 'bg-pink-100 text-pink-800',
}

export function UsuariosPage() {
  const [showCrearModal, setShowCrearModal] = useState(false)
  const [showEditarModal, setShowEditarModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Estados para cambio de contraseña
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordUser, setPasswordUser] = useState<any>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Estados para eliminar usuario
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteUser, setDeleteUser] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const { users, loading, refreshUsers } = useUsers()
  const { user: currentUser } = useAuthStore()

  const handleEditUser = (user: any) => {
    setSelectedUser(user)
    setShowEditarModal(true)
  }

  const isSuperAdmin = currentUser?.role === 'super_admin'

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await deactivateUser(userId)
        alert('✅ Usuario desactivado exitosamente')
      } else {
        await activateUser(userId)
        alert('✅ Usuario activado exitosamente')
      }
      refreshUsers()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    }
  }

  const handleOpenPasswordModal = (user: any) => {
    setPasswordUser(user)
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowPasswordModal(true)
  }

  const handleChangePassword = async () => {
    if (!passwordUser) return
    const pwValidation = validatePassword(newPassword)
    if (!pwValidation.isValid) { alert('Contraseña insegura: ' + pwValidation.errors.join(', ')); return }
    if (newPassword !== confirmPassword) { alert('Las contraseñas no coinciden'); return }
    setPasswordLoading(true)
    try {
      await adminChangeUserPassword(passwordUser.id, newPassword)
      alert(`✅ Contraseña de ${passwordUser.first_name} ${passwordUser.last_name} actualizada exitosamente`)
      setShowPasswordModal(false)
      setPasswordUser(null)
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleOpenDeleteModal = (user: any) => {
    setDeleteUser(user)
    setDeleteConfirmText('')
    setShowDeleteModal(true)
  }

  const handleDeleteUser = async () => {
    if (!deleteUser) return
    if (deleteConfirmText !== 'ELIMINAR') { alert('Escribe ELIMINAR para confirmar'); return }
    setDeleteLoading(true)
    try {
      await deleteUserCompletely(deleteUser.id)
      alert(`✅ Usuario ${deleteUser.first_name} ${deleteUser.last_name} eliminado completamente`)
      setShowDeleteModal(false)
      setDeleteUser(null)
      refreshUsers()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!confirm(`¿Cambiar el rol de este usuario a ${ROLE_LABELS[newRole]}?`)) {
      return
    }

    try {
      await updateUser(userId, { role: newRole })
      alert('✅ Rol actualizado exitosamente')
      refreshUsers()
    } catch (error: any) {
      alert('❌ Error: ' + error.message)
    }
  }

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
    const matchesSearch = 
      fullName.includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole = filterRole === 'all' || user.role === filterRole
    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'active' && user.is_active) ||
      (filterStatus === 'inactive' && !user.is_active)

    return matchesSearch && matchesRole && matchesStatus
  })

  if (!isSuperAdmin) {
    return (
      <DashboardLayout title="Usuarios" subtitle="Gestión de usuarios del sistema">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-600">Solo los Super Administradores pueden gestionar usuarios.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout 
      title="Usuarios" 
      subtitle="Gestión de usuarios del sistema"
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
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Filtro por rol */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Todos los roles</option>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
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
              Crear Usuario
            </Button>
          </div>

          {/* Contador */}
          <div className="mt-4 text-sm text-gray-600">
            Mostrando {filteredUsers.length} de {users.length} usuarios
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-900">No se encontraron usuarios</p>
              <p className="text-sm text-gray-500 mt-1">Intenta ajustar los filtros de búsqueda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ubicación / Área
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contacto
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
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-semibold">
                              {user.first_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value)}
                          disabled={user.id === currentUser?.id}
                          className={`text-xs font-medium px-3 py-1 rounded-full border-0 ${ROLE_COLORS[user.role]} ${
                            user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
                          }`}
                          style={{ colorScheme: 'light' }}
                        >
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value} className="bg-white text-gray-900 text-sm">{label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.department ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.department}</div>
                            {user.area && (
                              <div className="text-xs text-gray-500">{user.area}</div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            Sin ubicación
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.phone || 'Sin teléfono'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleOpenPasswordModal(user)}
                          disabled={user.id === currentUser?.id}
                          className={`text-indigo-600 hover:text-indigo-900 ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          Contraseña
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user.id, user.is_active)}
                          disabled={user.id === currentUser?.id}
                          className={`${
                            user.is_active
                              ? 'text-red-600 hover:text-red-900'
                              : 'text-green-600 hover:text-green-900'
                          } ${
                            user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {user.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(user)}
                          disabled={user.id === currentUser?.id}
                          className={`text-red-600 hover:text-red-900 font-semibold ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          Eliminar
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Usuarios</span>
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-green-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-600">Activos</span>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {users.filter(u => u.is_active).length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-600">Inactivos</span>
              <span className="text-2xl">⛔</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {users.filter(u => !u.is_active).length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-600">Admins</span>
              <span className="text-2xl">👑</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {users.filter(u => u.role === 'super_admin' || u.role === 'admin').length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-amber-600">Sin Ubicación</span>
              <span className="text-2xl">📍</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {users.filter(u => !u.department).length}
            </p>
            {users.filter(u => !u.department).length > 0 && (
              <p className="text-xs text-amber-500 mt-1">Requieren edición</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Crear Usuario */}
      <CrearUsuarioModal
        isOpen={showCrearModal}
        onClose={() => setShowCrearModal(false)}
        onSuccess={refreshUsers}
      />

      {/* Modal de Editar Usuario */}
      <EditarUsuarioModal
        isOpen={showEditarModal}
        onClose={() => {
          setShowEditarModal(false)
          setSelectedUser(null)
        }}
        onSuccess={refreshUsers}
        user={selectedUser}
      />

      {/* Modal de Cambiar Contraseña */}
      {showPasswordModal && passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPasswordModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 z-10">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Cambiar Contraseña</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {passwordUser.first_name} {passwordUser.last_name} ({passwordUser.email})
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva Contraseña *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPassword
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Contraseña *</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowPasswordModal(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleChangePassword}
                loading={passwordLoading}
                disabled={passwordLoading || newPassword.length < 8 || newPassword !== confirmPassword || !validatePassword(newPassword).isValid}
                className="flex-1"
              >
                Cambiar Contraseña
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Eliminar Usuario */}
      {showDeleteModal && deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Eliminar Usuario</h3>
                <p className="text-sm text-red-600">Esta acción es irreversible</p>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800 dark:text-red-300">
                Se eliminará permanentemente a <strong>{deleteUser.first_name} {deleteUser.last_name}</strong> ({deleteUser.email}):
              </p>
              <ul className="text-xs text-red-700 dark:text-red-400 mt-2 space-y-1 ml-4 list-disc">
                <li>Todos sus permisos asignados</li>
                <li>Su registro en la base de datos</li>
                <li>Su cuenta de autenticación</li>
              </ul>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Escribe <strong className="text-red-600">ELIMINAR</strong> para confirmar
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="ELIMINAR"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleDeleteUser}
                loading={deleteLoading}
                disabled={deleteLoading || deleteConfirmText !== 'ELIMINAR'}
                className="flex-1 !bg-red-600 hover:!bg-red-700"
              >
                Eliminar Permanentemente
              </Button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  )
}