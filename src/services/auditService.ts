import { supabase } from '@/lib/supabase'
import type { AuditLog } from '@/types'

// Registrar un evento de auditoría
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

// Obtener logs de auditoría con filtros
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

// Obtener módulos únicos para filtros
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

// Obtener acciones únicas para filtros
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
