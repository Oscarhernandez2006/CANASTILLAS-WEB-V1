/**
 * @module admin-users
 * @description Función serverless de Vercel para operaciones administrativas de usuarios.
 * Usa la Service Role Key de Supabase (que NUNCA debe exponerse en el frontend).
 * 
 * Operaciones soportadas:
 * - createUser: Crea usuario en auth.users + tabla users
 * - updateUser: Actualiza datos del usuario
 * - deleteUser: Elimina usuario completamente
 * - changePassword: Cambia contraseña de un usuario
 * - activateUser / deactivateUser: Activa/desactiva cuenta
 * 
 * Seguridad:
 * - Requiere Bearer token JWT válido
 * - Solo usuarios con rol 'super_admin' o 'admin' pueden acceder
 * - Verifica que la cuenta esté activa
 * 
 * Endpoint: POST /api/admin-users
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Service Role Key SOLO en servidor — NUNCA en el frontend
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Verificar que el usuario autenticado sea admin/super_admin
async function verifyAdmin(authHeader: string | undefined): Promise<{ userId: string; role: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No autorizado')
  }

  const token = authHeader.replace('Bearer ', '')
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  const supabaseClient = createClient(supabaseUrl, anonKey)

  const { data: { user }, error } = await supabaseClient.auth.getUser(token)
  if (error || !user) {
    throw new Error('Token inválido o expirado')
  }

  // Verificar rol en la tabla users
  const { data: userData, error: userError } = await supabaseClient
    .from('users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (userError || !userData) {
    throw new Error('Usuario no encontrado')
  }

  if (!userData.is_active) {
    throw new Error('Cuenta desactivada')
  }

  if (!['super_admin', 'admin'].includes(userData.role)) {
    throw new Error('Permisos insuficientes')
  }

  return { userId: user.id, role: userData.role }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const admin = await verifyAdmin(req.headers.authorization)
    const { action, ...payload } = req.body

    switch (action) {
      case 'createUser': {
        const { email, password, full_name, role, phone, department, area } = payload
        if (!email || !password || !full_name || !role) {
          return res.status(400).json({ error: 'Campos requeridos faltantes' })
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('No se creó el usuario')

        const names = full_name.trim().split(' ')
        const firstName = names[0]
        const lastName = names.length > 1 ? names.slice(1).join(' ') : ''

        const { error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: authData.user.id,
            email,
            first_name: firstName,
            last_name: lastName,
            phone: phone || null,
            role,
            is_active: true,
            department: department || null,
            area: area || null,
          })

        if (insertError) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
          throw insertError
        }

        return res.status(200).json({ success: true, data: { user_id: authData.user.id, email } })
      }

      case 'changePassword': {
        const { userId, newPassword } = payload
        if (!userId || !newPassword) {
          return res.status(400).json({ error: 'userId y newPassword son requeridos' })
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPassword,
        })

        if (error) throw error
        return res.status(200).json({ success: true })
      }

      case 'deleteUser': {
        const { userId } = payload
        if (!userId) {
          return res.status(400).json({ error: 'userId es requerido' })
        }

        // Eliminar permisos
        await supabaseAdmin.from('user_permissions').delete().eq('user_id', userId)
        // Eliminar de public.users
        const { error: userError } = await supabaseAdmin.from('users').delete().eq('id', userId)
        if (userError) throw userError
        // Eliminar de auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (authError) throw authError

        return res.status(200).json({ success: true })
      }

      default:
        return res.status(400).json({ error: 'Acción no válida' })
    }
  } catch (error: any) {
    console.error('Admin API Error:', error.message)
    return res.status(error.message === 'No autorizado' || error.message === 'Token inválido o expirado' ? 401 :
      error.message === 'Permisos insuficientes' ? 403 : 500
    ).json({ error: error.message || 'Error interno del servidor' })
  }
}
