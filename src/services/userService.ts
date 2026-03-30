import { supabase, callAdminAPI } from '@/lib/supabase'

export interface CreateUserData {
  email: string
  password: string
  full_name: string
  role: string
  phone?: string
  department?: string  // Ubicación del usuario
  area?: string        // Área del usuario
}

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

// Crear usuario usando API serverless segura
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

// Obtener todos los usuarios
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

// Actualizar usuario
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

// Desactivar usuario (soft delete)
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

// Activar usuario
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

// Cambiar contraseña (usuario propio)
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

// Cambiar contraseña de otro usuario (admin) — vía API serverless
export const adminChangeUserPassword = async (userId: string, newPassword: string) => {
  try {
    const result = await callAdminAPI('changePassword', { userId, newPassword })
    return result
  } catch (error: any) {
    console.error('Error changing user password:', error)
    throw error
  }
}

// Eliminar usuario completamente — vía API serverless
export const deleteUserCompletely = async (userId: string) => {
  try {
    const result = await callAdminAPI('deleteUser', { userId })
    return result
  } catch (error: any) {
    console.error('Error deleting user:', error)
    throw error
  }
}