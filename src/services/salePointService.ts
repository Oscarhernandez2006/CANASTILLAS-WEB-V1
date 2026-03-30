/**
 * @module salePointService
 * @description Servicio CRUD para la gestión de clientes y puntos de venta.
 * Los clientes pueden ser de tipo PUNTO_VENTA (internos) o CLIENTE_EXTERNO.
 * Los datos se almacenan en la tabla `sale_points` de Supabase.
 */

import { supabase } from '@/lib/supabase'

/** Datos requeridos para crear un nuevo cliente/punto de venta */
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

/** Datos opcionales para actualizar un cliente/punto de venta existente */
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

/**
 * Crea un nuevo cliente/punto de venta en la base de datos.
 * @param data - Datos del cliente a crear
 * @returns El registro creado
 * @throws Error si falla la inserción
 */
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

/**
 * Actualiza los datos de un cliente/punto de venta existente.
 * @param id - UUID del cliente a actualizar
 * @param data - Campos a actualizar (solo los proporcionados)
 * @returns El registro actualizado
 */
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

/**
 * Desactiva un cliente/punto de venta (soft delete).
 * @param id - UUID del cliente a desactivar
 * @returns El registro actualizado con is_active = false
 */
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

/**
 * Reactiva un cliente/punto de venta previamente desactivado.
 * @param id - UUID del cliente a activar
 * @returns El registro actualizado con is_active = true
 */
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

/**
 * Obtiene todos los clientes/puntos de venta ordenados por fecha de creación.
 * @returns Array de todos los clientes (activos e inactivos)
 */
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

/**
 * Obtiene un cliente/punto de venta específico por su ID.
 * @param id - UUID del cliente
 * @returns El registro del cliente
 */
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