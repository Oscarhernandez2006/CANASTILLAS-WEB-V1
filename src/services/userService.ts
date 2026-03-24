import { supabase, supabaseAdmin } from '@/lib/supabase'

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

// Crear usuario usando Auth Admin API de Supabase
export const createUser = async (userData: CreateUserData) => {
  try {
    if (!supabaseAdmin) {
      throw new Error('Service role key no configurada. Agrega VITE_SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.')
    }

    // Separar nombre
    const names = userData.full_name.trim().split(' ')
    const firstName = names[0]
    const lastName = names.length > 1 ? names.slice(1).join(' ') : ''

    console.log('🔵 Creando usuario con Auth Admin API:', userData.email)

    // 1. Crear usuario en auth usando la Admin API (GoTrue nativo)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: { full_name: userData.full_name },
    })

    if (authError) {
      console.error('🔴 Error Auth Admin:', authError)
      throw authError
    }

    if (!authData.user) {
      throw new Error('No se recibió usuario de Auth Admin')
    }

    const userId = authData.user.id

    // 2. Insertar en public.users
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: userData.email,
        first_name: firstName,
        last_name: lastName,
        phone: userData.phone || null,
        role: userData.role,
        is_active: true,
        department: userData.department || null,
        area: userData.area || null,
      })

    if (insertError) {
      console.error('🔴 Error insertando en public.users:', insertError)
      // Intentar limpiar el auth user si falla el insert
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw insertError
    }

    console.log('✅ Usuario creado exitosamente:', { user_id: userId, email: userData.email })
    return { success: true, data: { user_id: userId, email: userData.email } }
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

// Cambiar contraseña de otro usuario (admin)
export const adminChangeUserPassword = async (userId: string, newPassword: string) => {
  try {
    if (!supabaseAdmin) {
      throw new Error('Service role key no configurada.')
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error changing user password:', error)
    throw error
  }
}

// Eliminar usuario completamente (permisos → users → auth)
export const deleteUserCompletely = async (userId: string) => {
  try {
    if (!supabaseAdmin) {
      throw new Error('Service role key no configurada.')
    }

    // 1. Eliminar permisos del usuario
    const { error: permError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)
    if (permError) console.warn('Error eliminando permisos:', permError.message)

    // 2. Eliminar registro de public.users
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
    if (userError) throw new Error('Error eliminando usuario de la base de datos: ' + userError.message)

    // 3. Eliminar de auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authError) throw new Error('Error eliminando usuario de autenticación: ' + authError.message)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting user:', error)
    throw error
  }
}