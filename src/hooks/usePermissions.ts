import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getMyPermissions } from '@/services/permissionService'
import type { UserPermission, PermissionKey } from '@/types'

export function usePermissions() {
  const { user } = useAuthStore()
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [loading, setLoading] = useState(true)

  // Super admin siempre tiene acceso total
  const isSuperAdmin = user?.role === 'super_admin'

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([])
      setLoading(false)
      return
    }

    // Super admin no necesita consultar permisos
    if (isSuperAdmin) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const userPermissions = await getMyPermissions()
      setPermissions(userPermissions)
    } catch (error) {
      console.error('Error fetching permissions:', error)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [user, isSuperAdmin])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  // ========== FUNCIÓN PRINCIPAL ==========

  // Verificar si tiene un permiso específico
  const hasPermission = useCallback((permissionKey: PermissionKey): boolean => {
    // Super admin siempre tiene todos los permisos
    if (isSuperAdmin) return true

    // Si no hay usuario, no tiene permisos
    if (!user) return false

    // Buscar el permiso específico
    const perm = permissions.find(p => p.permission_key === permissionKey)
    return perm?.is_granted ?? false
  }, [user, isSuperAdmin, permissions])

  // ========== FUNCIONES DE ACCESO A MÓDULOS ==========

  const canAccessDashboard = useCallback((): boolean => {
    return hasPermission('dashboard.ver')
  }, [hasPermission])

  const canAccessInventario = useCallback((): boolean => {
    return hasPermission('inventario.ver')
  }, [hasPermission])

  const canAccessTraspasos = useCallback((): boolean => {
    return hasPermission('traspasos.ver')
  }, [hasPermission])

  const canAccessAlquileres = useCallback((): boolean => {
    return hasPermission('alquileres.ver')
  }, [hasPermission])

  const canAccessCanastillas = useCallback((): boolean => {
    return hasPermission('canastillas.ver')
  }, [hasPermission])

  const canAccessClientes = useCallback((): boolean => {
    return hasPermission('clientes.ver')
  }, [hasPermission])

  const canAccessUsuarios = useCallback((): boolean => {
    return hasPermission('usuarios.ver')
  }, [hasPermission])

  const canAccessReportes = useCallback((): boolean => {
    return hasPermission('reportes.ver')
  }, [hasPermission])

  // ========== COMPATIBILIDAD CON CÓDIGO EXISTENTE ==========

  // Para el Sidebar - acceso a canastillas o inventario
  const canAccessCanastillasMenu = useCallback((): boolean => {
    return hasPermission('canastillas.ver') || hasPermission('inventario.ver')
  }, [hasPermission])

  // Para CanastillasPage - permisos CRUD (compatibilidad)
  const hasCanastillaPermission = useCallback((action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    switch (action) {
      case 'view':
        return hasPermission('canastillas.ver')
      case 'create':
        return hasPermission('canastillas.crear_lote')
      case 'edit':
        return hasPermission('canastillas.editar')
      case 'delete':
        return hasPermission('canastillas.dar_salida')
      default:
        return false
    }
  }, [hasPermission])

  return {
    // Estado
    permissions,
    loading,
    isSuperAdmin,

    // Función principal
    hasPermission,
    refetchPermissions: fetchPermissions,

    // Acceso a módulos
    canAccessDashboard,
    canAccessInventario,
    canAccessTraspasos,
    canAccessAlquileres,
    canAccessCanastillas,
    canAccessClientes,
    canAccessUsuarios,
    canAccessReportes,

    // Compatibilidad
    canAccessCanastillasMenu,
    hasCanastillaPermission,
  }
}
