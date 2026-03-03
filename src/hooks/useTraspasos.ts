import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface Transfer {
  id: string
  from_user_id: string
  to_user_id: string
  status: string
  requested_at: string
  responded_at?: string
  remision_number?: string
  from_user?: {
    first_name: string
    last_name: string
    email: string
  }
  to_user?: {
    first_name: string
    last_name: string
    email: string
  }
  transfer_items?: any[]
  items_count?: number // Conteo real de canastillas
}

export function useTraspasos() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState<Transfer[]>([])
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState<Transfer[]>([])
  const [historial, setHistorial] = useState<Transfer[]>([])

  useEffect(() => {
    if (user) {
      fetchTraspasos()
    }
  }, [user])

  const fetchTraspasos = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Función auxiliar para obtener el conteo real de items
      const getItemsCount = async (transferId: string): Promise<number> => {
        const { count, error } = await supabase
          .from('transfer_items')
          .select('*', { count: 'exact', head: true })
          .eq('transfer_id', transferId)

        if (error) {
          console.error('Error counting items:', error)
          return 0
        }
        return count || 0
      }

      // TRASPASOS RECIBIDOS (pendientes)
      const { data: received, error: receivedError } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:from_user_id(first_name, last_name, email)
        `)
        .eq('to_user_id', user.id)
        .eq('status', 'PENDIENTE')
        .order('requested_at', { ascending: false })

      if (receivedError) {
        console.error('Error fetching received transfers:', receivedError)
        throw receivedError
      }

      // Obtener conteo de items para traspasos recibidos
      const receivedWithCounts = await Promise.all(
        (received || []).map(async (t) => ({
          ...t,
          items_count: await getItemsCount(t.id),
          transfer_items: [] // placeholder vacío
        }))
      )

      // TRASPASOS ENVIADOS (pendientes)
      const { data: sent, error: sentError } = await supabase
        .from('transfers')
        .select(`
          *,
          to_user:to_user_id(first_name, last_name, email)
        `)
        .eq('from_user_id', user.id)
        .eq('status', 'PENDIENTE')
        .order('requested_at', { ascending: false })

      if (sentError) {
        console.error('Error fetching sent transfers:', sentError)
        throw sentError
      }

      // Obtener conteo de items para traspasos enviados
      const sentWithCounts = await Promise.all(
        (sent || []).map(async (t) => ({
          ...t,
          items_count: await getItemsCount(t.id),
          transfer_items: [] // placeholder vacío
        }))
      )

      // HISTORIAL (aceptados, rechazados y cancelados)
      const { data: history, error: historyError } = await supabase
        .from('transfers')
        .select(`
          *,
          from_user:from_user_id(first_name, last_name, email),
          to_user:to_user_id(first_name, last_name, email)
        `)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .in('status', ['ACEPTADO', 'RECHAZADO', 'CANCELADO'])
        .order('responded_at', { ascending: false })
        .limit(50)

      if (historyError) {
        console.error('Error fetching history:', historyError)
        throw historyError
      }

      // Obtener conteo de items para historial
      const historyWithCounts = await Promise.all(
        (history || []).map(async (t) => ({
          ...t,
          items_count: await getItemsCount(t.id),
          transfer_items: [] // placeholder vacío
        }))
      )

      setSolicitudesRecibidas(receivedWithCounts)
      setSolicitudesEnviadas(sentWithCounts)
      setHistorial(historyWithCounts)
    } catch (error) {
      console.error('Error fetching traspasos:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshTraspasos = () => {
    fetchTraspasos()
  }

  return {
    loading,
    solicitudesRecibidas,
    solicitudesEnviadas,
    historial,
    refreshTraspasos,
  }
}