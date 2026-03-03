import { useState, useEffect } from 'react'
import { Button } from './Button'
import { DynamicSelect } from './DynamicSelect'
import { updateUser } from '@/services/userService'
import { useCanastillaAttributes } from '@/hooks/useCanastillaAttributes'

interface User {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: string
  is_active: boolean
  department: string | null
  area: string | null
}

interface EditarUsuarioModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  user: User | null
}

const ROLES = [
  { value: 'super_admin', label: 'Super Administrador', description: 'Acceso total al sistema' },
  { value: 'admin', label: 'Administrador', description: 'Gestión completa excepto usuarios' },
  { value: 'supervisor', label: 'Supervisor', description: 'Ver y editar (sin eliminar)' },
  { value: 'logistics', label: 'Logística', description: 'Gestión de traspasos y alquileres' },
  { value: 'conductor', label: 'Conductor', description: 'Transporte y entrega de canastillas' },
  { value: 'operator', label: 'Operador', description: 'Solo lectura' },
  { value: 'washing_staff', label: 'Personal de Lavado', description: 'Gestión de lavado de canastillas' },
  { value: 'client', label: 'Cliente', description: 'Acceso limitado' },
]

export function EditarUsuarioModal({ isOpen, onClose, onSuccess, user }: EditarUsuarioModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Hooks para obtener ubicaciones y áreas
  const { attributes: ubicaciones, addAttribute: addUbicacion } = useCanastillaAttributes('UBICACION')
  const { attributes: areas, addAttribute: addArea } = useCanastillaAttributes('AREA')

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'operator',
    department: '',
    area: '',
  })

  // Cargar datos del usuario cuando se abre el modal
  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || 'operator',
        department: user.department || '',
        area: user.area || '',
      })
      setError('')
    }
  }, [user, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    // Validaciones
    if (!formData.first_name) {
      setError('El nombre es obligatorio')
      return
    }

    if (!formData.department) {
      setError('La ubicación es obligatoria para la trazabilidad de canastillas')
      return
    }

    setLoading(true)
    setError('')

    try {
      await updateUser(user.id, {
        first_name: formData.first_name,
        last_name: formData.last_name || undefined,
        email: formData.email,
        phone: formData.phone || undefined,
        role: formData.role,
        department: formData.department || undefined,
        area: formData.area || undefined,
      })

      alert('Usuario actualizado exitosamente')
      onSuccess()
      handleClose()
    } catch (err: any) {
      console.error('Error updating user:', err)
      setError(err.message || 'Error al actualizar el usuario')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: 'operator',
      department: '',
      area: '',
    })
    setError('')
    onClose()
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        ></div>

        {/* Modal */}
        <div
          className="inline-block align-bottom bg-white rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Editar Usuario
              </h3>
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

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Info del usuario */}
              <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">
                  <strong>Email:</strong> {user.email}
                </p>
              </div>

              {/* Nombre y Apellido */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Nombre"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Apellido"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="+57 300 123 4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rol *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {ROLES.find(r => r.value === formData.role)?.description}
                </p>
              </div>

              {/* Ubicación y Área - Importante para trazabilidad */}
              <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">
                  <strong>Importante:</strong> La ubicación y área determinan dónde se moverán las canastillas cuando este usuario las reciba en un traspaso.
                </p>
              </div>

              {!formData.department && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                  <p className="text-sm">
                    <strong>Atención:</strong> Este usuario no tiene ubicación asignada. Es importante asignarle una para la correcta trazabilidad de las canastillas.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <DynamicSelect
                    label="Ubicación"
                    value={formData.department}
                    options={ubicaciones}
                    onChange={(value) => setFormData({ ...formData, department: value })}
                    onAddNew={addUbicacion}
                    placeholder="Seleccionar ubicación"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ej: Bodega Principal, Planta Norte
                  </p>
                </div>

                <div>
                  <DynamicSelect
                    label="Área"
                    value={formData.area}
                    options={areas}
                    onChange={(value) => setFormData({ ...formData, area: value })}
                    onAddNew={addArea}
                    placeholder="Seleccionar área"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ej: Producción, Despacho
                  </p>
                </div>
              </div>
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
                type="submit"
                loading={loading}
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
