/**
 * @module useLavado
 * @description Hook para operaciones del módulo de lavado de canastillas.
 * Gestiona el flujo completo: envío, recepción, proceso, entrega y confirmación
 * de órdenes de lavado, tanto para usuarios normales como para personal de lavado.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { WashingOrder } from '@/types'

/**
 * Hook que gestiona las órdenes de lavado de canastillas.
 * Diferencia entre el rol de usuario normal (envíos, confirmaciones)
 * y personal de lavado (recepción, proceso, entrega).
 * @returns Objeto con listas de órdenes por estado, contadores, rol del usuario y función de refresco.
 * @returns {WashingOrder[]} misEnvios - Órdenes enviadas por el usuario (rol normal).
 * @returns {WashingOrder[]} porConfirmar - Órdenes entregadas pendientes de confirmación (rol normal).
 * @returns {WashingOrder[]} porRecibir - Órdenes por recibir (rol lavado).
 * @returns {WashingOrder[]} enProceso - Órdenes en proceso de lavado (rol lavado).
 * @returns {WashingOrder[]} porEntregar - Órdenes listas para entregar (rol lavado).
 * @returns {WashingOrder[]} historial - Historial de órdenes completadas/canceladas.
 * @returns {boolean} isWashingStaff - Indica si el usuario es personal de lavado.
 * @returns {Function} refreshLavado - Recarga todos los datos.
 */
export function useLavado() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)

  // Para usuarios normales - órdenes que han enviado
  const [misEnvios, setMisEnvios] = useState<WashingOrder[]>([])

  // Para usuarios normales - órdenes entregadas pendientes de confirmar
  const [porConfirmar, setPorConfirmar] = useState<WashingOrder[]>([])

  // Para personal de lavado - órdenes por recibir
  const [porRecibir, setPorRecibir] = useState<WashingOrder[]>([])

  // Para personal de lavado - órdenes en proceso de lavado
  const [enProceso, setEnProceso] = useState<WashingOrder[]>([])

  // Para personal de lavado - órdenes listas para entregar
  const [porEntregar, setPorEntregar] = useState<WashingOrder[]>([])

  // Historial de órdenes completadas/canceladas
  const [historial, setHistorial] = useState<WashingOrder[]>([])

  const isWashingStaff = user?.role === 'washing_staff'

  const fetchLavado = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      if (isWashingStaff) {
        // ===== PERSONAL DE LAVADO =====

        // Órdenes por recibir (ENVIADO)
        const { data: toReceive, error: toReceiveError } = await supabase
          .from('washing_orders')
          .select(`
            *,
            sender_user:sender_user_id(id, first_name, last_name, email),
            washing_items:washing_order_items(
              *,
              canastilla:canastilla_id(id, codigo, size, color, status)
            )
          `)
          .eq('status', 'ENVIADO')
          .order('sent_at', { ascending: true })

        if (toReceiveError) throw toReceiveError
        setPorRecibir(toReceive || [])

        // Órdenes en proceso (RECIBIDO - asignadas a este staff)
        const { data: inProcess, error: inProcessError } = await supabase
          .from('washing_orders')
          .select(`
            *,
            sender_user:sender_user_id(id, first_name, last_name, email),
            washing_items:washing_order_items(
              *,
              canastilla:canastilla_id(id, codigo, size, color, status)
            )
          `)
          .eq('washing_staff_id', user.id)
          .eq('status', 'RECIBIDO')
          .order('received_at', { ascending: true })

        if (inProcessError) throw inProcessError
        setEnProceso(inProcess || [])

        // Órdenes por entregar (LAVADO_COMPLETADO - asignadas a este staff)
        const { data: toDeliver, error: toDeliverError } = await supabase
          .from('washing_orders')
          .select(`
            *,
            sender_user:sender_user_id(id, first_name, last_name, email),
            washing_items:washing_order_items(
              *,
              canastilla:canastilla_id(id, codigo, size, color, status)
            )
          `)
          .eq('washing_staff_id', user.id)
          .eq('status', 'LAVADO_COMPLETADO')
          .order('washed_at', { ascending: true })

        if (toDeliverError) throw toDeliverError
        setPorEntregar(toDeliver || [])

        // Historial del personal de lavado
        const { data: staffHistory, error: staffHistoryError } = await supabase
          .from('washing_orders')
          .select(`
            *,
            sender_user:sender_user_id(id, first_name, last_name, email),
            washing_items:washing_order_items(
              *,
              canastilla:canastilla_id(id, codigo, size, color, status)
            )
          `)
          .eq('washing_staff_id', user.id)
          .in('status', ['CONFIRMADO', 'CANCELADO', 'ENTREGADO'])
          .order('updated_at', { ascending: false })
          .limit(50)

        if (staffHistoryError) throw staffHistoryError
        setHistorial(staffHistory || [])

      } else {
        // ===== USUARIO NORMAL =====

        // Mis envíos activos (ENVIADO, RECIBIDO, LAVADO_COMPLETADO)
        const { data: mySent, error: mySentError } = await supabase
          .from('washing_orders')
          .select(`
            *,
            washing_staff:washing_staff_id(id, first_name, last_name, email),
            washing_items:washing_order_items(
              *,
              canastilla:canastilla_id(id, codigo, size, color, status)
            )
          `)
          .eq('sender_user_id', user.id)
          .in('status', ['ENVIADO', 'RECIBIDO', 'LAVADO_COMPLETADO'])
          .order('sent_at', { ascending: false })

        if (mySentError) throw mySentError
        setMisEnvios(mySent || [])

        // Por confirmar (ENTREGADO)
        const { data: toConfirm, error: toConfirmError } = await supabase
          .from('washing_orders')
          .select(`
            *,
            washing_staff:washing_staff_id(id, first_name, last_name, email),
            washing_items:washing_order_items(
              *,
              canastilla:canastilla_id(id, codigo, size, color, status)
            )
          `)
          .eq('sender_user_id', user.id)
          .eq('status', 'ENTREGADO')
          .order('delivered_at', { ascending: false })

        if (toConfirmError) throw toConfirmError
        setPorConfirmar(toConfirm || [])

        // Historial del usuario
        const { data: userHistory, error: userHistoryError } = await supabase
          .from('washing_orders')
          .select(`
            *,
            washing_staff:washing_staff_id(id, first_name, last_name, email),
            washing_items:washing_order_items(
              *,
              canastilla:canastilla_id(id, codigo, size, color, status)
            )
          `)
          .eq('sender_user_id', user.id)
          .in('status', ['CONFIRMADO', 'CANCELADO'])
          .order('updated_at', { ascending: false })
          .limit(50)

        if (userHistoryError) throw userHistoryError
        setHistorial(userHistory || [])
      }

    } catch (error) {
      console.error('Error fetching lavado:', error)
    } finally {
      setLoading(false)
    }
  }, [user, isWashingStaff])

  useEffect(() => {
    if (user) {
      fetchLavado()
    }
  }, [user, fetchLavado])

  const refreshLavado = useCallback(() => {
    fetchLavado()
  }, [fetchLavado])

  // Contadores para badges
  const contadores = {
    misEnvios: misEnvios.length,
    porConfirmar: porConfirmar.length,
    porRecibir: porRecibir.length,
    enProceso: enProceso.length,
    porEntregar: porEntregar.length,
    historial: historial.length,
  }

  return {
    loading,
    // Para usuarios normales
    misEnvios,
    porConfirmar,
    // Para personal de lavado
    porRecibir,
    enProceso,
    porEntregar,
    // Común
    historial,
    contadores,
    isWashingStaff,
    refreshLavado,
  }
}
