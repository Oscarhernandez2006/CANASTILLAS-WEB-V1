import { supabase } from '@/lib/supabase'
import type { UserPermission, PermissionKey, PermissionModule, PermissionUpdate } from '@/types'

// ========== CONFIGURACIÓN DE PERMISOS ==========

// Todos los permisos organizados por módulo
export const PERMISSIONS_CONFIG: Record<PermissionModule, {
  label: string
  permissions: { key: PermissionKey; label: string; description: string }[]
}> = {
  dashboard: {
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.ver', label: 'Ver Dashboard', description: 'Acceder al panel de control y ver estadísticas' },
    ],
  },
  inventario: {
    label: 'Inventario',
    permissions: [
      { key: 'inventario.ver', label: 'Ver Inventario', description: 'Ver el inventario de canastillas propias' },
      { key: 'inventario.ver_todos', label: 'Ver Todo el Inventario', description: 'Ver el inventario de todos los usuarios (admin)' },
    ],
  },
  traspasos: {
    label: 'Traspasos',
    permissions: [
      { key: 'traspasos.ver', label: 'Ver Traspasos', description: 'Acceder al módulo de traspasos' },
      { key: 'traspasos.solicitar', label: 'Solicitar Traspaso', description: 'Crear nuevas solicitudes de traspaso' },
      { key: 'traspasos.aprobar_rechazar', label: 'Aprobar/Rechazar', description: 'Aprobar o rechazar solicitudes recibidas' },
      { key: 'traspasos.cancelar', label: 'Cancelar Solicitudes', description: 'Cancelar solicitudes enviadas' },
      { key: 'traspasos.ver_historial', label: 'Ver Historial', description: 'Ver historial de traspasos completados' },
    ],
  },
  alquileres: {
    label: 'Alquileres',
    permissions: [
      { key: 'alquileres.ver', label: 'Ver Alquileres', description: 'Acceder al módulo de alquileres' },
      { key: 'alquileres.crear', label: 'Crear Alquiler', description: 'Crear nuevos alquileres' },
      { key: 'alquileres.procesar_retorno', label: 'Procesar Retorno', description: 'Procesar el retorno de canastillas' },
      { key: 'alquileres.descargar_remision', label: 'Descargar Remisión', description: 'Descargar remisiones en PDF' },
      { key: 'alquileres.descargar_factura', label: 'Descargar Factura', description: 'Descargar facturas en PDF' },
      { key: 'alquileres.ver_configuracion', label: 'Ver Configuración', description: 'Ver configuración de tarifas' },
      { key: 'alquileres.editar_configuracion', label: 'Editar Tarifas', description: 'Modificar las tarifas de alquiler (diaria e interna)' },
    ],
  },
  canastillas: {
    label: 'Canastillas',
    permissions: [
      { key: 'canastillas.ver', label: 'Ver Canastillas', description: 'Acceder al módulo de canastillas' },
      { key: 'canastillas.crear_lote', label: 'Crear Lote', description: 'Crear lotes de canastillas nuevas' },
      { key: 'canastillas.editar', label: 'Editar Canastilla', description: 'Editar información de canastillas' },
      { key: 'canastillas.dar_salida', label: 'Dar Salida', description: 'Dar de baja canastillas del inventario' },
      { key: 'canastillas.ver_qr', label: 'Ver QR', description: 'Ver detalles y código QR de canastillas' },
    ],
  },
  clientes: {
    label: 'Clientes',
    permissions: [
      { key: 'clientes.ver', label: 'Ver Clientes', description: 'Acceder al módulo de clientes' },
      { key: 'clientes.crear', label: 'Crear Cliente', description: 'Crear nuevos clientes' },
      { key: 'clientes.editar', label: 'Editar Cliente', description: 'Editar información de clientes' },
      { key: 'clientes.activar_desactivar', label: 'Activar/Desactivar', description: 'Activar o desactivar clientes' },
    ],
  },
  usuarios: {
    label: 'Usuarios',
    permissions: [
      { key: 'usuarios.ver', label: 'Ver Usuarios', description: 'Acceder al módulo de usuarios' },
      { key: 'usuarios.crear', label: 'Crear Usuario', description: 'Crear nuevos usuarios' },
      { key: 'usuarios.cambiar_rol', label: 'Cambiar Rol', description: 'Cambiar el rol de usuarios' },
      { key: 'usuarios.activar_desactivar', label: 'Activar/Desactivar', description: 'Activar o desactivar usuarios' },
    ],
  },
  reportes: {
    label: 'Reportes',
    permissions: [
      { key: 'reportes.ver', label: 'Ver Reportes', description: 'Acceder al módulo de reportes' },
      { key: 'reportes.inventario', label: 'Reporte Inventario', description: 'Generar reporte de inventario de canastillas' },
      { key: 'reportes.alquileres', label: 'Reporte Alquileres', description: 'Generar reporte de alquileres' },
      { key: 'reportes.traspasos', label: 'Reporte Traspasos', description: 'Generar reporte de traspasos' },
      { key: 'reportes.clientes', label: 'Reporte Clientes', description: 'Generar reporte de clientes' },
      { key: 'reportes.usuarios', label: 'Reporte Usuarios', description: 'Generar reporte de usuarios' },
      { key: 'reportes.ingresos', label: 'Reporte Ingresos', description: 'Generar reporte de ingresos por período' },
      { key: 'reportes.canastillas_alquiladas', label: 'Top Canastillas', description: 'Generar ranking de canastillas más alquiladas' },
      { key: 'reportes.clientes_frecuentes', label: 'Top Clientes', description: 'Generar ranking de clientes frecuentes' },
    ],
  },
  geolocalizacion: {
    label: 'Geolocalización',
    permissions: [
      { key: 'geolocalizacion.ver', label: 'Ver Geolocalización', description: 'Acceder al módulo de geolocalización' },
      { key: 'geolocalizacion.ver_mapa', label: 'Ver Mapa', description: 'Ver el mapa con ubicaciones en tiempo real' },
      { key: 'geolocalizacion.ver_conductores', label: 'Ver Conductores', description: 'Ver ubicación de conductores y su velocidad' },
    ],
  },
  facturacion: {
    label: 'Facturación',
    permissions: [
      { key: 'facturacion.ver', label: 'Ver Facturación', description: 'Acceder al módulo de facturación mensual' },
      { key: 'facturacion.generar', label: 'Generar Factura', description: 'Generar y re-generar facturas mensuales' },
      { key: 'facturacion.cerrar', label: 'Cierre de Factura', description: 'Realizar cierre total de facturas mensuales' },
    ],
  },
  consultar_facturacion: {
    label: 'Consultar Facturación',
    permissions: [
      { key: 'consultar_facturacion.ver', label: 'Ver Consultas', description: 'Consultar facturas cerradas (solo lectura)' },
    ],
  },
  cargue_pdv: {
    label: 'Cargue Inventario PDV',
    permissions: [
      { key: 'cargue_pdv.ver', label: 'Ver Cargue PDV', description: 'Acceder al módulo de cargue de inventario PDV' },
      { key: 'cargue_pdv.cargar', label: 'Realizar Cargue', description: 'Subir el inventario mensual del punto de venta' },
    ],
  },
  control_pdv: {
    label: 'Control Inventario PDV',
    permissions: [
      { key: 'control_pdv.ver', label: 'Ver Control PDV', description: 'Ver los cargues de inventario de todos los puntos de venta' },
      { key: 'control_pdv.habilitar_extension', label: 'Habilitar 2da Oportunidad', description: 'Otorgar segunda oportunidad de cargue a un PDV' },
    ],
  },
  auditoria: {
    label: 'Auditoría',
    permissions: [
      { key: 'auditoria.ver', label: 'Ver Auditoría', description: 'Acceder al módulo de auditoría y ver registros de actividad' },
      { key: 'auditoria.exportar', label: 'Exportar Auditoría', description: 'Exportar registros de auditoría a Excel' },
    ],
  },
  rutas: {
    label: 'Rutas de Entrega',
    permissions: [
      { key: 'rutas.ver', label: 'Ver Rutas', description: 'Acceder al módulo de rutas de entrega y recolección' },
      { key: 'rutas.crear', label: 'Crear Ruta', description: 'Crear y editar rutas de entrega' },
      { key: 'rutas.asignar', label: 'Asignar Conductor', description: 'Asignar conductores a las rutas' },
      { key: 'rutas.ver_seguimiento', label: 'Ver Seguimiento', description: 'Ver el seguimiento en tiempo real de las rutas' },
    ],
  },
}

// Lista de todos los módulos en orden
export const ALL_MODULES: PermissionModule[] = [
  'dashboard',
  'inventario',
  'traspasos',
  'alquileres',
  'canastillas',
  'clientes',
  'usuarios',
  'reportes',
  'geolocalizacion',
  'facturacion',
  'consultar_facturacion',
  'cargue_pdv',
  'control_pdv',
  'auditoria',
  'rutas',
]

// Lista de todas las claves de permisos
export const ALL_PERMISSION_KEYS: PermissionKey[] = ALL_MODULES.flatMap(
  module => PERMISSIONS_CONFIG[module].permissions.map(p => p.key)
)

// ========== FUNCIONES DE SERVICIO ==========

// Obtener permisos de un usuario específico
export const getUserPermissions = async (userId: string): Promise<UserPermission[]> => {
  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error
    return data || []
  } catch (error: any) {
    console.error('Error getting user permissions:', error)
    throw error
  }
}

// Obtener permisos del usuario actual
export const getMyPermissions = async (): Promise<UserPermission[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error
    return data || []
  } catch (error: any) {
    console.error('Error getting my permissions:', error)
    return []
  }
}

// Actualizar permisos de un usuario (crear o actualizar)
export const updateUserPermissions = async (
  userId: string,
  permissions: PermissionUpdate[]
): Promise<void> => {
  try {
    // Preparar registros para upsert
    const records = permissions.map(p => ({
      user_id: userId,
      permission_key: p.permission_key,
      is_granted: p.is_granted,
    }))

    const { error } = await supabase
      .from('user_permissions')
      .upsert(records, {
        onConflict: 'user_id,permission_key',
        ignoreDuplicates: false,
      })

    if (error) throw error
  } catch (error: any) {
    console.error('Error updating user permissions:', error)
    throw error
  }
}

// Establecer un permiso específico
export const setPermission = async (
  userId: string,
  permissionKey: PermissionKey,
  isGranted: boolean
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_permissions')
      .upsert({
        user_id: userId,
        permission_key: permissionKey,
        is_granted: isGranted,
      }, {
        onConflict: 'user_id,permission_key',
        ignoreDuplicates: false,
      })

    if (error) throw error
  } catch (error: any) {
    console.error('Error setting permission:', error)
    throw error
  }
}

// Eliminar todos los permisos de un usuario
export const deleteUserPermissions = async (userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)

    if (error) throw error
  } catch (error: any) {
    console.error('Error deleting user permissions:', error)
    throw error
  }
}

// Copiar permisos de un usuario a otro
export const copyUserPermissions = async (
  fromUserId: string,
  toUserId: string
): Promise<void> => {
  try {
    const sourcePermissions = await getUserPermissions(fromUserId)

    if (sourcePermissions.length === 0) {
      return
    }

    const permissions: PermissionUpdate[] = sourcePermissions.map(p => ({
      permission_key: p.permission_key,
      is_granted: p.is_granted,
    }))

    await updateUserPermissions(toUserId, permissions)
  } catch (error: any) {
    console.error('Error copying user permissions:', error)
    throw error
  }
}

// Obtener el label de un módulo
export const getModuleLabel = (module: PermissionModule): string => {
  return PERMISSIONS_CONFIG[module]?.label || module
}

// Obtener información de un permiso
export const getPermissionInfo = (key: PermissionKey): { label: string; description: string } | null => {
  for (const module of ALL_MODULES) {
    const perm = PERMISSIONS_CONFIG[module].permissions.find(p => p.key === key)
    if (perm) {
      return { label: perm.label, description: perm.description }
    }
  }
  return null
}
