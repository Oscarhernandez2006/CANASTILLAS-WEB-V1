import { supabase } from '@/lib/supabase'

export interface CreateSalePointData {
  name: string
  code: string
  contact_name: string
  contact_phone: string
  contact_email?: string
  address: string
  city: string
  region: string
  client_type: 'PUNTO_VENTA' | 'CLIENTE_EXTERNO'
  identification?: string
}

export interface UpdateSalePointData {
  name?: string
  code?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  address?: string
  city?: string
  region?: string
  client_type?: 'PUNTO_VENTA' | 'CLIENTE_EXTERNO'
  identification?: string
  is_active?: boolean
}

// Crear cliente
export const createSalePoint = async (data: CreateSalePointData) => {
  try {
    const { data: result, error } = await supabase
      .from('sale_points')
      .insert([{
        ...data,
        is_active: true,
      }])
      .select()
      .single()

    if (error) throw error
    return result
  } catch (error: any) {
    console.error('Error creating sale point:', error)
    throw new Error(error.message || 'Error al crear cliente')
  }
}

// Actualizar cliente
export const updateSalePoint = async (id: string, data: UpdateSalePointData) => {
  try {
    const { data: result, error } = await supabase
      .from('sale_points')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return result
  } catch (error: any) {
    console.error('Error updating sale point:', error)
    throw new Error(error.message || 'Error al actualizar cliente')
  }
}

// Desactivar cliente
export const deactivateSalePoint = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from('sale_points')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    console.error('Error deactivating sale point:', error)
    throw error
  }
}

// Activar cliente
export const activateSalePoint = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from('sale_points')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    console.error('Error activating sale point:', error)
    throw error
  }
}

// Obtener todos los clientes
export const getAllSalePoints = async () => {
  try {
    const { data, error } = await supabase
      .from('sale_points')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error: any) {
    console.error('Error getting sale points:', error)
    throw error
  }
}

// Obtener cliente por ID
export const getSalePointById = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from('sale_points')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    console.error('Error getting sale point:', error)
    throw error
  }
}