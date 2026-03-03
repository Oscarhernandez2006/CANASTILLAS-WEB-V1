import { supabase } from '@/lib/supabase'

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

// Crear usuario usando función de base de datos
export const createUser = async (userData: CreateUserData) => {
  try {
    console.log('🔵 Llamando a create_user_direct con:', {
      p_email: userData.email,
      p_full_name: userData.full_name,
      p_role: userData.role,
      p_phone: userData.phone || null,
    })

    const { data, error } = await supabase.rpc('create_user_direct', {
      p_email: userData.email,
      p_password: userData.password,
      p_full_name: userData.full_name,
      p_role: userData.role,
      p_phone: userData.phone || null,
    })

    console.log('🔵 Respuesta de Supabase:', { data, error })

    if (error) {
      console.error('🔴 Error de Supabase:', error)
      throw error
    }

    if (!data) {
      throw new Error('No se recibió respuesta de la función')
    }

    // Si se proporcionaron ubicación/área, actualizar el usuario
    if (userData.department || userData.area) {
      const userId = data.user_id || data.id || data
      if (userId) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            department: userData.department || null,
            area: userData.area || null,
          })
          .eq('id', userId)

        if (updateError) {
          console.warn('⚠️ No se pudo actualizar ubicación/área:', updateError)
        }
      }
    }

    console.log('✅ Usuario creado exitosamente:', data)
    return { success: true, data }
  } catch (error: any) {
    console.error('🔴 Error completo:', error)
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

// Cambiar contraseña
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