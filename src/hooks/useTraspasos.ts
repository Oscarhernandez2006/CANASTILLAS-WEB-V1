/**
 * @module useTraspasos
 * @description Hook para la interfaz de traspasos con soporte avanzado.
 * Gestiona solicitudes recibidas/enviadas, historial, devoluciones externas
 * y conteo real de items para superar límites de Supabase.
 */
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
  is_washing_transfer?: boolean
  is_external_transfer?: boolean
  external_recipient_name?: string
  external_recipient_cedula?: string
  external_recipient_phone?: string
  external_recipient_empresa?: string
  returned_items_count?: number
  pending_items_count?: number
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
  en_alquiler_count?: number // Canastillas en alquiler dentro del traspaso
}

/**
 * Hook que gestiona la interfaz completa de traspasos del usuario actual.
 * @returns Objeto con solicitudes recibidas/enviadas, historial, devoluciones externas y estado de carga.
 * @returns {Transfer[]} solicitudesRecibidas - Traspasos pendientes dirigidos al usuario.
 * @returns {Transfer[]} solicitudesEnviadas - Traspasos pendientes creados por el usuario.
 * @returns {Transfer[]} historial - Historial de traspasos completados.
 * @returns {Transfer[]} devolucionesExternas - Traspasos externos con devoluciones pendientes.
 * @returns {boolean} loading - Estado de carga.
 */
export function useTraspasos() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState<Transfer[]>([])
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState<Transfer[]>([])
  const [historial, setHistorial] = useState<Transfer[]>([])
  const [devolucionesExternas, setDevolucionesExternas] = useState<Transfer[]>([])
  const [pickupsPendientes, setPickupsPendientes] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      fetchTraspasos()
    }
  }, [user])

  const fetchTraspasos = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Auto-aceptar traspasos PENDIENTES con más de 7 horas
      // Las canastillas viajan al destinatario automáticamente
      try {
        await supabase.rpc('auto_accept_pending_transfers')
      } catch (autoAcceptErr) {
        // Fallback: intentar con la función legacy
        try {
          await supabase.rpc('expire_pending_transfers')
        } catch (legacyErr) {
          console.warn('No se pudo ejecutar auto_accept RPC:', legacyErr)
        }
      }

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

      // Función auxiliar para obtener el conteo de canastillas EN_ALQUILER en un traspaso
      const getEnAlquilerCount = async (transferId: string): Promise<number> => {
        const { count, error } = await supabase
          .from('transfer_items')
          .select('*, canastillas!inner(*)', { count: 'exact', head: true })
          .eq('transfer_id', transferId)
          .eq('canastillas.status', 'EN_ALQUILER')

        if (error) {
          console.error('Error counting en_alquiler items:', error)
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
          en_alquiler_count: await getEnAlquilerCount(t.id),
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
          en_alquiler_count: await getEnAlquilerCount(t.id),
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
        .in('status', ['ACEPTADO', 'RECHAZADO', 'CANCELADO', 'EXPIRADA', 'ACEPTADO_AUTO'])
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
          en_alquiler_count: await getEnAlquilerCount(t.id),
          transfer_items: [] // placeholder vacío
        }))
      )

      // DEVOLUCIONES EXTERNAS PENDIENTES (solo para super_admin)
      if (user.role === 'super_admin') {
        const { data: externalPending, error: externalError } = await supabase
          .from('transfers')
          .select(`
            *,
            from_user:from_user_id(first_name, last_name, email),
            to_user:to_user_id(first_name, last_name, email),
            sale_point:sale_points(id, name, contact_name, contact_phone, address, city, identification),
            return_user:return_user_id(first_name, last_name, email)
          `)
          .eq('status', 'ACEPTADO')
          .eq('is_external_transfer', true)
          .order('responded_at', { ascending: false })

        if (externalError) {
          console.error('Error fetching external pending returns:', externalError)
        }

        const externalWithCounts = await Promise.all(
          (externalPending || []).map(async (t) => ({
            ...t,
            items_count: await getItemsCount(t.id),
            en_alquiler_count: await getEnAlquilerCount(t.id),
            transfer_items: []
          }))
        )

        const devolucionesPendientes = externalWithCounts.filter(t => {
          const pending = t.pending_items_count ?? (t.items_count || 0)
          return pending > 0
        })

        setDevolucionesExternas(devolucionesPendientes)
      } else {
        setDevolucionesExternas([])
      }

      setSolicitudesRecibidas(receivedWithCounts)
      setSolicitudesEnviadas(sentWithCounts)
      setHistorial(historyWithCounts)

      // RECOGIDAS PENDIENTES (para conductores)
      if (user.role === 'conductor') {
        const { data: pickups, error: pickupsError } = await supabase
          .from('pickup_assignments')
          .select(`
            *,
            transfer:transfers(
              id, remision_number, external_recipient_name, external_recipient_cedula,
              external_recipient_phone, external_recipient_empresa,
              returned_items_count, pending_items_count,
              from_user:from_user_id(first_name, last_name, email),
              sale_point:sale_points(id, name, contact_name, contact_phone, address, city)
            ),
            assigned_by_user:assigned_by(first_name, last_name)
          `)
          .eq('assigned_to', user.id)
          .eq('status', 'PENDIENTE')
          .order('created_at', { ascending: false })

        if (pickupsError) {
          console.error('Error fetching pickups:', pickupsError)
        }

        // Obtener conteo de items por cada pickup
        const pickupsWithCounts = await Promise.all(
          (pickups || []).map(async (p) => {
            const { count } = await supabase
              .from('pickup_assignment_items')
              .select('*', { count: 'exact', head: true })
              .eq('pickup_assignment_id', p.id)
            return { ...p, items_count: count || 0 }
          })
        )

        setPickupsPendientes(pickupsWithCounts)
      } else {
        setPickupsPendientes([])
      }
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
    devolucionesExternas,
    pickupsPendientes,
    refreshTraspasos,
  }
}