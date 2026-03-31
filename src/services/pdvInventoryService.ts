/**
 * @module pdvInventoryService
 * @description Servicio de gestión del cargue de inventario mensual por usuarios PDV (Puntos de Venta).
 * 
 * Los usuarios PDV deben cargar su inventario el último día de cada mes.
 * Si no lo hacen, el sistema los bloquea hasta que completen el cargue.
 * Los administradores pueden otorgar extensiones de plazo.
 * 
 * Tablas involucradas: `pdv_inventory_uploads`, `pdv_inventory_upload_items`, `pdv_upload_extensions`.
 */

import { supabase } from '@/lib/supabase'

// ========== UTILIDADES DE FECHA ==========

/**
 * Calcula el último día de un mes específico.
 * @param year - Año
 * @param month - Mes (1-12)
 * @returns Número del último día del mes
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Verifica si hoy es el último día del mes actual.
 * @returns true si hoy es el último día
 */
export function isLastDayOfMonth(): boolean {
  const now = new Date()
  const lastDay = getLastDayOfMonth(now.getFullYear(), now.getMonth() + 1)
  return now.getDate() === lastDay
}

/**
 * Calcula cuántos días faltan hasta el último día del mes actual.
 * @returns Número de días restantes
 */
export function getDaysUntilLastDay(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const lastDay = getLastDayOfMonth(year, month)
  return lastDay - now.getDate()
}

/**
 * Obtiene el período actual (mes y año).
 * @returns Objeto con month (1-12) y year
 */
export function getCurrentPeriod(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

// ========== CARGUE DE INVENTARIO (PDV) ==========

/** Datos de un item del cargue de inventario */
export interface UploadItem {
  canastilla_size: string
  canastilla_color: string
  cantidad: number
}

/** Registro de cargue de inventario PDV */
export interface PdvUpload {
  id: string
  user_id: string
  user_name: string
  user_cedula: string | null
  period_month: number
  period_year: number
  status: string
  is_late: boolean
  no_canastillas: boolean
  extension_granted_by: string | null
  extension_granted_at: string | null
  uploaded_at: string
  created_at: string
  items?: PdvUploadItem[]
}

/** Item individual dentro de un cargue de inventario */
export interface PdvUploadItem {
  id: string
  upload_id: string
  canastilla_size: string
  canastilla_color: string
  cantidad: number
}

/** Extensión de plazo otorgada a un usuario PDV */
export interface PdvExtension {
  id: string
  pdv_user_id: string
  period_month: number
  period_year: number
  granted_by: string
  granted_by_name: string
  reason: string | null
  is_used: boolean
  used_at: string | null
  created_at: string
}

/**
 * Verifica si un usuario PDV ya cargó inventario en el mes actual.
 * @param userId - UUID del usuario PDV
 * @returns true si ya existe un cargue para este período
 */
export async function hasUploadedThisMonth(userId: string): Promise<boolean> {
  const { month, year } = getCurrentPeriod()
  const { data, error } = await supabase
    .from('pdv_inventory_uploads')
    .select('id')
    .eq('user_id', userId)
    .eq('period_month', month)
    .eq('period_year', year)
    .maybeSingle()

  if (error) {
    console.error('Error checking upload:', error)
    return false
  }
  return !!data
}

/**
 * Verifica si existe una extensión de plazo disponible (no usada) para el mes actual.
 * @param userId - UUID del usuario PDV
 * @returns La extensión disponible o null
 */
export async function hasExtensionAvailable(userId: string): Promise<PdvExtension | null> {
  const { month, year } = getCurrentPeriod()
  const { data, error } = await supabase
    .from('pdv_upload_extensions')
    .select('*')
    .eq('pdv_user_id', userId)
    .eq('period_month', month)
    .eq('period_year', year)
    .eq('is_used', false)
    .maybeSingle()

  if (error) {
    console.error('Error checking extension:', error)
    return null
  }
  return data
}

/**
 * Determina si un usuario PDV debe cargar inventario ahora.
 * Retorna true si es el último día del mes y no ha cargado,
 * o si tiene una extensión pendiente.
 * @param userId - UUID del usuario PDV
 * @returns true si debe cargar inventario
 */
export async function mustUploadNow(userId: string): Promise<boolean> {
  if (!isLastDayOfMonth()) {
    // Si no es último día, revisar si hay extensión pendiente
    const extension = await hasExtensionAvailable(userId)
    if (extension) {
      const hasUploaded = await hasUploadedThisMonth(userId)
      return !hasUploaded
    }
    return false
  }
  const hasUploaded = await hasUploadedThisMonth(userId)
  return !hasUploaded
}

/**
 * Obtiene los tipos de canastilla disponibles agrupados por tamaño y color.
 * @returns Array de tipos con tamaño, color y cantidad total
 */
export async function getCanastillaTypes(): Promise<{ size: string; color: string; total: number }[]> {
  const { data, error } = await supabase
    .from('canastillas')
    .select('size, color')
    .not('status', 'eq', 'DADA_DE_BAJA')

  if (error) {
    console.error('Error fetching canastilla types:', error)
    throw error
  }

  // Agrupar por size + color
  const grouped: Record<string, { size: string; color: string; total: number }> = {}
  for (const item of data || []) {
    const key = `${item.size}_${item.color}`
    if (!grouped[key]) {
      grouped[key] = { size: item.size, color: item.color, total: 0 }
    }
    grouped[key].total++
  }

  return Object.values(grouped).sort((a, b) => `${a.size}_${a.color}`.localeCompare(`${b.size}_${b.color}`))
}

/**
 * Crea un cargue de inventario para un usuario PDV.
 * Si es tardío (fuera del último día), marca la extensión como usada.
 * @param userId - UUID del usuario PDV
 * @param userName - Nombre completo
 * @param userCedula - Cédula del usuario
 * @param items - Array de items con tipo de canastilla y cantidad
 * @returns El registro de cargue creado
 */
export async function createInventoryUpload(
  userId: string,
  userName: string,
  userCedula: string | null,
  items: UploadItem[],
  noCanastillas: boolean = false
): Promise<PdvUpload> {
  const { month, year } = getCurrentPeriod()
  const isLate = !isLastDayOfMonth()

  // Si es tardío, marcar la extensión como usada
  if (isLate) {
    const extension = await hasExtensionAvailable(userId)
    if (extension) {
      await supabase
        .from('pdv_upload_extensions')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', extension.id)
    }
  }

  // Crear el upload
  const { data: upload, error: uploadError } = await supabase
    .from('pdv_inventory_uploads')
    .insert({
      user_id: userId,
      user_name: userName,
      user_cedula: userCedula,
      period_month: month,
      period_year: year,
      status: 'completado',
      is_late: isLate,
      no_canastillas: noCanastillas,
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (uploadError) throw uploadError

  // Insertar items
  const itemsToInsert = items
    .filter(i => i.cantidad > 0)
    .map(i => ({
      upload_id: upload.id,
      canastilla_size: i.canastilla_size,
      canastilla_color: i.canastilla_color,
      cantidad: i.cantidad,
    }))

  if (itemsToInsert.length > 0) {
    const { error: itemsError } = await supabase
      .from('pdv_inventory_upload_items')
      .insert(itemsToInsert)

    if (itemsError) throw itemsError
  }

  return upload
}

// ========== CONTROL DE INVENTARIO (ADMIN) ==========

/**
 * Obtiene todos los usuarios con rol PDV activos.
 * @returns Array de usuarios PDV
 */
export async function getPdvUsers(): Promise<any[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, phone, department, area, is_active')
    .eq('role', 'pdv')
    .eq('is_active', true)
    .order('first_name')

  if (error) throw error
  return data || []
}

/**
 * Obtiene los cargues de inventario de un período específico.
 * @param month - Mes (1-12)
 * @param year - Año
 * @returns Array de cargues con sus items
 */
export async function getUploadsByPeriod(month: number, year: number): Promise<PdvUpload[]> {
  const { data, error } = await supabase
    .from('pdv_inventory_uploads')
    .select(`
      *,
      items:pdv_inventory_upload_items(*)
    `)
    .eq('period_month', month)
    .eq('period_year', year)
    .order('uploaded_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Obtiene el historial de cargues de un usuario PDV específico.
 * @param userId - UUID del usuario
 * @returns Array de cargues ordenados por período descendente
 */
export async function getUploadsByUser(userId: string): Promise<PdvUpload[]> {
  const { data, error } = await supabase
    .from('pdv_inventory_uploads')
    .select(`
      *,
      items:pdv_inventory_upload_items(*)
    `)
    .eq('user_id', userId)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Obtiene el inventario real de canastillas asignadas a un usuario PDV.
 * Agrupa por tamaño y color para comparar con el inventario declarado.
 * @param userId - UUID del usuario PDV
 * @returns Array de tipos con cantidad real
 */
export async function getRealInventoryForPdv(userId: string): Promise<{ size: string; color: string; cantidad: number }[]> {
  const { data, error } = await supabase
    .from('canastillas')
    .select('size, color')
    .eq('current_owner_id', userId)
    .not('status', 'in', '(DADA_DE_BAJA,FUERA_SERVICIO)')

  if (error) throw error

  const grouped: Record<string, { size: string; color: string; cantidad: number }> = {}
  for (const item of data || []) {
    const key = `${item.size}_${item.color}`
    if (!grouped[key]) {
      grouped[key] = { size: item.size, color: item.color, cantidad: 0 }
    }
    grouped[key].cantidad++
  }

  return Object.values(grouped).sort((a, b) => `${a.size}_${a.color}`.localeCompare(`${b.size}_${b.color}`))
}

/**
 * Otorga una extensión de plazo a un usuario PDV para el mes actual.
 * @param pdvUserId - UUID del usuario PDV
 * @param grantedBy - UUID del admin que otorga
 * @param grantedByName - Nombre del admin
 * @param reason - Razón de la extensión (opcional)
 * @returns El registro de extensión creado
 */
export async function grantUploadExtension(
  pdvUserId: string,
  grantedBy: string,
  grantedByName: string,
  reason?: string
): Promise<PdvExtension> {
  const { month, year } = getCurrentPeriod()

  const { data, error } = await supabase
    .from('pdv_upload_extensions')
    .insert({
      pdv_user_id: pdvUserId,
      period_month: month,
      period_year: year,
      granted_by: grantedBy,
      granted_by_name: grantedByName,
      reason: reason || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Obtiene las extensiones otorgadas en un período específico.
 * @param month - Mes (1-12)
 * @param year - Año
 * @returns Array de extensiones
 */
export async function getExtensionsByPeriod(month: number, year: number): Promise<PdvExtension[]> {
  const { data, error } = await supabase
    .from('pdv_upload_extensions')
    .select('*')
    .eq('period_month', month)
    .eq('period_year', year)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Obtiene el cargue del mes actual del usuario (si existe).
 * @param userId - UUID del usuario PDV
 * @returns El cargue actual o null
 */
export async function getMyCurrentUpload(userId: string): Promise<PdvUpload | null> {
  const { month, year } = getCurrentPeriod()
  const { data, error } = await supabase
    .from('pdv_inventory_uploads')
    .select(`
      *,
      items:pdv_inventory_upload_items(*)
    `)
    .eq('user_id', userId)
    .eq('period_month', month)
    .eq('period_year', year)
    .maybeSingle()

  if (error) {
    console.error('Error fetching current upload:', error)
    return null
  }
  return data
}

/**
 * Obtiene el historial de cargues del usuario (máximo 12 meses).
 * @param userId - UUID del usuario PDV
 * @returns Array de cargues con sus items
 */
export async function getMyUploadHistory(userId: string): Promise<PdvUpload[]> {
  const { data, error } = await supabase
    .from('pdv_inventory_uploads')
    .select(`
      *,
      items:pdv_inventory_upload_items(*)
    `)
    .eq('user_id', userId)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(12)

  if (error) {
    console.error('Error fetching upload history:', error)
    return []
  }
  return data || []
}
