/**
 * @module auditService
 * @description Servicio de auditoría del sistema. Registra y consulta todos los eventos
 * de actividad de los usuarios (login, CRUD, exportaciones, traspasos, etc.).
 * Los logs se almacenan en la tabla `audit_logs` de Supabase.
 */

import { supabase } from '@/lib/supabase'
import type { AuditLog } from '@/types'

/**
 * Registra un evento de auditoría en la base de datos.
 * Se llama desde los distintos módulos del sistema para dejar trazabilidad.
 * @param params - Datos del evento a registrar
 * @param params.userId - ID del usuario que realizó la acción
 * @param params.userName - Nombre completo del usuario
 * @param params.userRole - Rol del usuario al momento de la acción
 * @param params.action - Tipo de acción (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, etc.)
 * @param params.module - Módulo del sistema donde ocurrió (canastillas, traspasos, alquileres, etc.)
 * @param params.description - Descripción legible del evento
 * @param params.details - Datos adicionales en formato JSON
 */
export async function logAuditEvent(params: {
  userId: string
  userName: string
  userRole?: string
  action: string
  module: string
  description: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: params.userId,
      user_name: params.userName,
      user_role: params.userRole || null,
      action: params.action,
      module: params.module,
      description: params.description,
      details: params.details || {},
    })
  } catch (error) {
    console.error('Error logging audit event:', error)
  }
}

/**
 * Obtiene los registros de auditoría con filtros opcionales y paginación.
 * @param filters - Filtros opcionales para la búsqueda
 * @param filters.module - Filtrar por módulo del sistema
 * @param filters.action - Filtrar por tipo de acción
 * @param filters.userId - Filtrar por usuario específico
 * @param filters.dateFrom - Fecha inicio (formato YYYY-MM-DD)
 * @param filters.dateTo - Fecha fin (formato YYYY-MM-DD)
 * @param filters.search - Búsqueda de texto en descripción o nombre de usuario
 * @param filters.limit - Cantidad máxima de resultados (default: 50)
 * @param filters.offset - Desplazamiento para paginación (default: 0)
 * @returns Objeto con los datos y el conteo total para paginación
 */
export async function getAuditLogs(filters?: {
  module?: string
  action?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ data: AuditLog[]; count: number }> {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters?.module) {
    query = query.eq('module', filters.module)
  }
  if (filters?.action) {
    query = query.eq('action', filters.action)
  }
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId)
  }
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom)
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo + 'T23:59:59')
  }
  if (filters?.search) {
    query = query.or(`description.ilike.%${filters.search}%,user_name.ilike.%${filters.search}%`)
  }

  const limit = filters?.limit || 50
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) throw error
  return { data: data || [], count: count || 0 }
}

/**
 * Retorna la lista de módulos del sistema disponibles para filtrar en auditoría.
 * @returns Array de objetos con value (clave interna) y label (nombre visible)
 */
export function getAuditModules(): { value: string; label: string }[] {
  return [
    { value: 'auth', label: 'Autenticación' },
    { value: 'canastillas', label: 'Canastillas' },
    { value: 'traspasos', label: 'Traspasos' },
    { value: 'alquileres', label: 'Alquileres' },
    { value: 'usuarios', label: 'Usuarios' },
    { value: 'clientes', label: 'Clientes' },
    { value: 'facturacion', label: 'Facturación' },
    { value: 'lavado', label: 'Lavado' },
    { value: 'permisos', label: 'Permisos' },
    { value: 'cargue_pdv', label: 'Cargue PDV' },
    { value: 'rutas', label: 'Rutas' },
    { value: 'inventario', label: 'Inventario' },
  ]
}

/**
 * Retorna la lista de tipos de acción disponibles para filtrar en auditoría.
 * @returns Array de objetos con value (clave interna) y label (nombre visible)
 */
export function getAuditActions(): { value: string; label: string }[] {
  return [
    { value: 'CREATE', label: 'Crear' },
    { value: 'UPDATE', label: 'Actualizar' },
    { value: 'DELETE', label: 'Eliminar' },
    { value: 'LOGIN', label: 'Inicio de sesión' },
    { value: 'LOGOUT', label: 'Cierre de sesión' },
    { value: 'EXPORT', label: 'Exportar' },
    { value: 'TRANSFER', label: 'Traspaso' },
    { value: 'RENTAL', label: 'Alquiler' },
    { value: 'RETURN', label: 'Devolución' },
    { value: 'WASH', label: 'Lavado' },
    { value: 'UPLOAD', label: 'Cargue' },
    { value: 'PERMISSION_CHANGE', label: 'Cambio de permiso' },
  ]
}
