import { supabase } from '@/lib/supabase'

// ========== UTILIDADES DE FECHA ==========

export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function isLastDayOfMonth(): boolean {
  const now = new Date()
  const lastDay = getLastDayOfMonth(now.getFullYear(), now.getMonth() + 1)
  return now.getDate() === lastDay
}

export function getDaysUntilLastDay(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const lastDay = getLastDayOfMonth(year, month)
  return lastDay - now.getDate()
}

export function getCurrentPeriod(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

// ========== CARGUE DE INVENTARIO (PDV) ==========

export interface UploadItem {
  canastilla_size: string
  canastilla_color: string
  cantidad: number
}

export interface PdvUpload {
  id: string
  user_id: string
  user_name: string
  user_cedula: string | null
  period_month: number
  period_year: number
  status: string
  is_late: boolean
  extension_granted_by: string | null
  extension_granted_at: string | null
  uploaded_at: string
  created_at: string
  items?: PdvUploadItem[]
}

export interface PdvUploadItem {
  id: string
  upload_id: string
  canastilla_size: string
  canastilla_color: string
  cantidad: number
}

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

// Verificar si el PDV ya cargó inventario este mes
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

// Verificar si hay extensión disponible para este mes
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

// Verificar si el PDV debe cargar inventario (último día del mes y no ha cargado)
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

// Obtener tipos de canastillas disponibles (agrupados por size y color)
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

// Crear cargue de inventario
export async function createInventoryUpload(
  userId: string,
  userName: string,
  userCedula: string | null,
  items: UploadItem[]
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

// Obtener todos los PDV users
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

// Obtener cargues por período
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

// Obtener cargues de un PDV específico
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

// Obtener inventario real de un PDV (basado en traspasos)
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

// Otorgar extensión de cargue
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

// Obtener extensiones de un período
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

// Obtener el cargue del mes actual del usuario
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

// Obtener historial de cargues del usuario
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
