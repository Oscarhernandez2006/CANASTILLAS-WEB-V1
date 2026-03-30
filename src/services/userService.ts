/**
 * @module userService
 * @description Servicio de gestión de usuarios del sistema.
 * Las operaciones que requieren la Service Role Key (crear, eliminar, cambiar contraseña de otros)
 * se ejecutan a través de la API serverless `/api/admin-users` mediante `callAdminAPI()`.
 * Las demás operaciones usan el cliente Supabase directamente.
 */

import { supabase, callAdminAPI } from '@/lib/supabase'

/** Datos requeridos para crear un nuevo usuario */
export interface CreateUserData {
  email: string
  password: string
  full_name: string
  role: string
  phone?: string
  department?: string  // Ubicación del usuario
  area?: string        // Área del usuario
}

/** Datos opcionales para actualizar un usuario existente */
export interface UpdateUserData {
  email?: string
  first_name?: string
  last_name?: string
  role?: string
  phone?: string
  is_active?: boolean
  department?: string  // Ubicación del usuario
  area?: string        // Área del usuario
}

/**
 * Crea un nuevo usuario en el sistema usando la API serverless segura.
 * Crea el usuario en auth.users de Supabase y en la tabla `users`.
 * @param userData - Datos del usuario a crear
 * @returns El resultado de la operación con el usuario creado
 * @throws Error si faltan campos requeridos o falla la creación
 */
export const createUser = async (userData: CreateUserData) => {
  try {
    const result = await callAdminAPI('createUser', {
      email: userData.email,
      password: userData.password,
      full_name: userData.full_name,
      role: userData.role,
      phone: userData.phone,
      department: userData.department,
      area: userData.area,
    })

    return result
  } catch (error: any) {
    console.error('Error creating user:', error)
    throw new Error(error.message || 'Error al crear usuario')
  }
}

/**
 * Obtiene todos los usuarios del sistema ordenados por fecha de creación.
 * @returns Array de usuarios con sus datos básicos
 */
export const getAllUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role, is_active, department, area, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error: any) {
    console.error('Error getting users:', error)
    throw error
  }
}

/**
 * Actualiza los datos de un usuario en la tabla `users`.
 * @param userId - UUID del usuario a actualizar
 * @param userData - Campos a actualizar
 * @returns El registro actualizado
 */
export const updateUser = async (userId: string, userData: UpdateUserData) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(userData)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    console.error('Error updating user:', error)
    throw error
  }
}

/**
 * Desactiva un usuario (soft delete). El usuario no podrá iniciar sesión.
 * @param userId - UUID del usuario a desactivar
 * @returns El registro actualizado
 */
export const deactivateUser = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    console.error('Error deactivating user:', error)
    throw error
  }
}

/**
 * Reactiva un usuario previamente desactivado.
 * @param userId - UUID del usuario a activar
 * @returns El registro actualizado
 */
export const activateUser = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: true })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error: any) {
    console.error('Error activating user:', error)
    throw error
  }
}

/**
 * Cambia la contraseña del usuario actualmente autenticado.
 * @param newPassword - Nueva contraseña
 * @returns Objeto de éxito
 */
export const changeUserPassword = async (newPassword: string) => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error changing password:', error)
    throw error
  }
}

/**
 * Cambia la contraseña de otro usuario (operación admin).
 * Se ejecuta vía API serverless con Service Role Key.
 * @param userId - UUID del usuario objetivo
 * @param newPassword - Nueva contraseña a asignar
 * @returns El resultado de la operación
 */
export const adminChangeUserPassword = async (userId: string, newPassword: string) => {
  try {
    const result = await callAdminAPI('changePassword', { userId, newPassword })
    return result
  } catch (error: any) {
    console.error('Error changing user password:', error)
    throw error
  }
}

/**
 * Elimina un usuario completamente del sistema (auth.users + tabla users).
 * Operación irreversible. Se ejecuta vía API serverless.
 * @param userId - UUID del usuario a eliminar
 * @returns El resultado de la operación
 */
export const deleteUserCompletely = async (userId: string) => {
  try {
    const result = await callAdminAPI('deleteUser', { userId })
    return result
  } catch (error: any) {
    console.error('Error deleting user:', error)
    throw error
  }
}