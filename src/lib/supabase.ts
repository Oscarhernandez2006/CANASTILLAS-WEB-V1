import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper para llamar a la API admin serverless (Service Role Key protegida en servidor)
export async function callAdminAPI(action: string, payload: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('No autenticado')
  }

  const response = await fetch('/api/admin-users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Error en operación administrativa')
  }

  return result
}