/** @module CrearUsuarioModal @description Modal para crear un nuevo usuario del sistema. */
import { useState } from 'react'
import { Button } from './Button'
import { DynamicSelect } from './DynamicSelect'
import { createUser } from '@/services/userService'
import { onlyLetters, onlyNumbers } from '@/utils/helpers'
import { validatePassword } from '@/utils/security'
import { useCanastillaAttributes } from '@/hooks/useCanastillaAttributes'
import { useAuthStore } from '@/store/authStore'
import { logAuditEvent } from '@/services/auditService'

interface CrearUsuarioModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const ROLES = [
  { value: 'super_admin', label: 'Super Administrador', description: 'Acceso total al sistema' },
  { value: 'admin', label: 'Administrador', description: 'Gestión completa excepto usuarios' },
  { value: 'supervisor', label: 'Supervisor', description: 'Ver y editar (sin eliminar)' },
  { value: 'logistics', label: 'Logística', description: 'Gestión de traspasos y alquileres' },
  { value: 'conductor', label: 'Conductor', description: 'Transporte y entrega de canastillas' },
  { value: 'pdv', label: 'PDV', description: 'Punto de venta' },
  { value: 'operator', label: 'Operador', description: 'Solo lectura' },
  { value: 'washing_staff', label: 'Personal de Lavado', description: 'Gestión de lavado de canastillas' },
  { value: 'client', label: 'Cliente', description: 'Acceso limitado' },
  { value: 'consultor_proceso', label: 'Consultor Proceso', description: 'Dashboard con ubicaciones de proceso' },
]

export function CrearUsuarioModal({ isOpen, onClose, onSuccess }: CrearUsuarioModalProps) {
  const { user: currentUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Hooks para obtener ubicaciones y áreas
  const { attributes: ubicaciones, addAttribute: addUbicacion } = useCanastillaAttributes('UBICACION')
  const { attributes: areas, addAttribute: addArea } = useCanastillaAttributes('AREA')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'operator',
    phone: '',
    department: '',  // Ubicación del usuario
    area: '',        // Área del usuario
  })

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  // Validaciones
  if (!formData.email || !formData.password || !formData.full_name || !formData.role) {
    setError('Por favor completa todos los campos requeridos')
    return
  }

  if (!formData.department) {
    setError('La ubicación es obligatoria para la trazabilidad de canastillas')
    return
  }

  if (formData.password.length < 8) {
    setError('La contraseña debe tener al menos 8 caracteres')
    return
  }

  const pwValidation = validatePassword(formData.password)
  if (!pwValidation.isValid) {
    setError('Contraseña insegura: ' + pwValidation.errors.join(', '))
    return
  }

  setLoading(true)
  setError('')

  try {
    console.log('📤 Enviando datos:', {
      email: formData.email,
      full_name: formData.full_name,
      role: formData.role,
      phone: formData.phone,
      department: formData.department,
      area: formData.area,
    })

    const result = await createUser({
      email: formData.email,
      password: formData.password,
      full_name: formData.full_name,
      role: formData.role,
      phone: formData.phone || undefined,
      department: formData.department || undefined,
      area: formData.area || undefined,
    })

    console.log('✅ Resultado:', result)

    if (currentUser) {
      await logAuditEvent({
        userId: currentUser.id,
        userName: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
        userRole: currentUser.role,
        action: 'CREATE',
        module: 'usuarios',
        description: `Creación de usuario: ${formData.full_name} (${formData.email}) con rol ${formData.role}`,
        details: { email: formData.email, nombre: formData.full_name, rol: formData.role, ubicacion: formData.department, area: formData.area },
      })
    }

    alert('✅ Usuario creado exitosamente. Ya puede iniciar sesión.')
    onSuccess()
    handleClose()
  } catch (err: any) {
    console.error('❌ Error creating user:', err)
    setError(err.message || 'Error al crear el usuario')
  } finally {
    setLoading(false)
  }
}

  const handleClose = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role: 'operator',
      phone: '',
      department: '',
      area: '',
    })
    setError('')
    setShowPassword(false)
    onClose()
  }

  if (!isOpen) return null

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
          className="inline-block align-bottom bg-white rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-[calc(100%-2rem)] sm:max-w-lg mx-4 sm:mx-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary-600 px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Crear Nuevo Usuario
              </h3>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 text-white hover:text-gray-200 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">
                  <strong>Nota:</strong> El usuario podrá iniciar sesión inmediatamente con las credenciales proporcionadas.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: onlyLetters(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Juan Pérez"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  El usuario usará esta contraseña para iniciar sesión
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: onlyNumbers(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="3001234567"
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

              {/* Ubicación y Área - Importante para trazabilidad de canastillas */}
              <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">
                  <strong>Importante:</strong> La ubicación y área determinan dónde se moverán las canastillas cuando este usuario las reciba en un traspaso.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-end space-x-3">
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
                {loading ? 'Creando...' : 'Crear Usuario'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}