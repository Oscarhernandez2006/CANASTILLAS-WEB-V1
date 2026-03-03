import { useState, useEffect } from 'react'
import { Button } from './Button'
import {
  getUserPermissions,
  updateUserPermissions,
  ALL_MODULES,
  PERMISSIONS_CONFIG
} from '@/services/permissionService'
import type { User, PermissionKey, PermissionModule, PermissionUpdate } from '@/types'

interface GestionarPermisosModalProps {
  isOpen: boolean
  onClose: () => void
  user: User
}

export function GestionarPermisosModal({ isOpen, onClose, user }: GestionarPermisosModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [grantedPermissions, setGrantedPermissions] = useState<Set<PermissionKey>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<PermissionModule>>(new Set(ALL_MODULES))

  useEffect(() => {
    if (isOpen && user) {
      loadPermissions()
    }
  }, [isOpen, user])

  const loadPermissions = async () => {
    try {
      setLoading(true)
      setError('')

      const userPermissions = await getUserPermissions(user.id)

      // Crear set de permisos otorgados
      const granted = new Set<PermissionKey>()
      userPermissions.forEach(p => {
        if (p.is_granted) {
          granted.add(p.permission_key)
        }
      })

      setGrantedPermissions(granted)
    } catch (err: any) {
      console.error('Error loading permissions:', err)
      setError('Error al cargar los permisos')
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (key: PermissionKey) => {
    setGrantedPermissions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const toggleModule = (module: PermissionModule) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev)
      if (newSet.has(module)) {
        newSet.delete(module)
      } else {
        newSet.add(module)
      }
      return newSet
    })
  }

  const toggleAllInModule = (module: PermissionModule, grant: boolean) => {
    const modulePermissions = PERMISSIONS_CONFIG[module].permissions
    setGrantedPermissions(prev => {
      const newSet = new Set(prev)
      modulePermissions.forEach(p => {
        if (grant) {
          newSet.add(p.key)
        } else {
          newSet.delete(p.key)
        }
      })
      return newSet
    })
  }

  const isModuleFullyGranted = (module: PermissionModule): boolean => {
    const modulePermissions = PERMISSIONS_CONFIG[module].permissions
    return modulePermissions.every(p => grantedPermissions.has(p.key))
  }

  const isModulePartiallyGranted = (module: PermissionModule): boolean => {
    const modulePermissions = PERMISSIONS_CONFIG[module].permissions
    const hasAny = modulePermissions.some(p => grantedPermissions.has(p.key))
    const hasAll = modulePermissions.every(p => grantedPermissions.has(p.key))
    return hasAny && !hasAll
  }

  const getModuleGrantedCount = (module: PermissionModule): number => {
    const modulePermissions = PERMISSIONS_CONFIG[module].permissions
    return modulePermissions.filter(p => grantedPermissions.has(p.key)).length
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')

      // Crear lista de actualizaciones para TODOS los permisos
      const permissionUpdates: PermissionUpdate[] = []

      ALL_MODULES.forEach(module => {
        PERMISSIONS_CONFIG[module].permissions.forEach(p => {
          permissionUpdates.push({
            permission_key: p.key,
            is_granted: grantedPermissions.has(p.key),
          })
        })
      })

      await updateUserPermissions(user.id, permissionUpdates)
      alert('Permisos guardados exitosamente')
      onClose()
    } catch (err: any) {
      console.error('Error saving permissions:', err)
      setError(err.message || 'Error al guardar los permisos')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-primary-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Gestionar Permisos
                </h3>
                <p className="text-sm text-primary-100 mt-1">
                  {user.first_name} {user.last_name} ({user.email})
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-white hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg">
                <p className="text-sm">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                <span className="ml-3 text-gray-600">Cargando permisos...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {ALL_MODULES.map((module) => {
                  const config = PERMISSIONS_CONFIG[module]
                  const isExpanded = expandedModules.has(module)
                  const fullyGranted = isModuleFullyGranted(module)
                  const partiallyGranted = isModulePartiallyGranted(module)
                  const grantedCount = getModuleGrantedCount(module)
                  const totalCount = config.permissions.length

                  return (
                    <div key={module} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Module Header */}
                      <div
                        className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                        onClick={() => toggleModule(module)}
                      >
                        <div className="flex items-center space-x-3">
                          <svg
                            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-semibold text-gray-900">{config.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            fullyGranted
                              ? 'bg-green-100 text-green-800'
                              : partiallyGranted
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-600'
                          }`}>
                            {grantedCount}/{totalCount}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleAllInModule(module, true)}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAllInModule(module, false)}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Ninguno
                          </button>
                        </div>
                      </div>

                      {/* Module Permissions */}
                      {isExpanded && (
                        <div className="px-4 py-3 space-y-2">
                          {config.permissions.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={grantedPermissions.has(perm.key)}
                                onChange={() => togglePermission(perm.key)}
                                className="mt-0.5 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {perm.label}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {perm.description}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Resumen */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Permisos otorgados:</strong> {grantedPermissions.size} de {
                  ALL_MODULES.reduce((acc, m) => acc + PERMISSIONS_CONFIG[m].permissions.length, 0)
                }
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Los cambios se aplicarán cuando el usuario inicie sesión nuevamente o recargue la página.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              loading={saving}
              disabled={loading || saving}
            >
              {saving ? 'Guardando...' : 'Guardar Permisos'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
