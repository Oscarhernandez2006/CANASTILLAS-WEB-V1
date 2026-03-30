/**
 * @module useTransfers
 * @description Hook para la gestión de traspasos de canastillas entre usuarios.
 * Obtiene traspasos enviados, recibidos y el historial completo del usuario actual.
 */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface Transfer {
  id: string
  from_user_id: string
  to_user_id: string
  status: string
  reason: string
  notes: string | null
  response_notes: string | null
  requested_at: string
  responded_at: string | null
  from_user: {
    first_name: string
    last_name: string
    email: string
  }
  to_user: {
    first_name: string
    last_name: string
    email: string
  }
  transfer_items: Array<{
    canastilla: {
      id: string
      codigo: string
      qr_code: string
      size: string
      color: string
    }
  }>
}

/**
 * Hook que obtiene los traspasos enviados, recibidos e historial del usuario actual.
 * @returns Objeto con listas de traspasos por categoría, estado de carga y función de refresco.
 * @returns {Transfer[]} enviados - Traspasos solicitados por el usuario.
 * @returns {Transfer[]} recibidos - Traspasos dirigidos al usuario.
 * @returns {Transfer[]} historial - Todos los traspasos no pendientes del usuario.
 * @returns {boolean} loading - Estado de carga.
 * @returns {Function} refreshTransfers - Recarga los datos.
 */
export function useTransfers() {
  const [enviados, setEnviados] = useState<Transfer[]>([])
  const [recibidos, setRecibidos] = useState<Transfer[]>([])
  const [historial, setHistorial] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    if (user) {
      fetchTransfers()
    }
  }, [user])

  const fetchTransfers = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Traspasos ENVIADOS (yo solicité)
      const { data: enviadosData, error: enviadosError } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:users!transfers_from_user_id_fkey(first_name, last_name, email),
          to_user:users!transfers_to_user_id_fkey(first_name, last_name, email),
          transfer_items(
            canastilla:canastillas(id, codigo, qr_code, size, color)
          )
        `)
        .eq('from_user_id', user.id)
        .order('requested_at', { ascending: false })

      if (enviadosError) throw enviadosError

      // Traspasos RECIBIDOS (me solicitaron)
      const { data: recibidosData, error: recibidosError } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:users!transfers_from_user_id_fkey(first_name, last_name, email),
          to_user:users!transfers_to_user_id_fkey(first_name, last_name, email),
          transfer_items(
            canastilla:canastillas(id, codigo, qr_code, size, color)
          )
        `)
        .eq('to_user_id', user.id)
        .order('requested_at', { ascending: false })

      if (recibidosError) throw recibidosError

      // HISTORIAL (todos mis traspasos)
      const { data: historialData, error: historialError } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:users!transfers_from_user_id_fkey(first_name, last_name, email),
          to_user:users!transfers_to_user_id_fkey(first_name, last_name, email),
          transfer_items(
            canastilla:canastillas(id, codigo, qr_code, size, color)
          )
        `)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .neq('status', 'PENDIENTE')
        .order('requested_at', { ascending: false })

      if (historialError) throw historialError

      setEnviados(enviadosData || [])
      setRecibidos(recibidosData || [])
      setHistorial(historialData || [])
    } catch (error) {
      console.error('Error fetching transfers:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshTransfers = () => {
    fetchTransfers()
  }

  return { 
    enviados, 
    recibidos, 
    historial, 
    loading, 
    refreshTransfers 
  }
}