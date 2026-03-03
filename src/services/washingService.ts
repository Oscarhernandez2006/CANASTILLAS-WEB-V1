import { supabase } from '@/lib/supabase'
import type { WashingOrder, WashingOrderStatus, WashingItemStatus } from '@/types'

// ========== FUNCIONES DE CONSULTA ==========

// Obtener todas las órdenes de lavado para un usuario
export const getWashingOrders = async (userId: string): Promise<WashingOrder[]> => {
  const { data, error } = await supabase
    .from('washing_orders')
    .select(`
      *,
      sender_user:sender_user_id(id, first_name, last_name, email),
      washing_staff:washing_staff_id(id, first_name, last_name, email),
      washing_items:washing_order_items(
        *,
        canastilla:canastilla_id(id, codigo, size, color, status)
      )
    `)
    .or(`sender_user_id.eq.${userId},washing_staff_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Obtener órdenes enviadas por un usuario (como remitente)
export const getSentOrders = async (userId: string): Promise<WashingOrder[]> => {
  const { data, error } = await supabase
    .from('washing_orders')
    .select(`
      *,
      washing_staff:washing_staff_id(id, first_name, last_name, email),
      washing_items:washing_order_items(
        *,
        canastilla:canastilla_id(id, codigo, size, color, status)
      )
    `)
    .eq('sender_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Obtener órdenes para el personal de lavado (todas las órdenes activas)
export const getOrdersForWashingStaff = async (): Promise<WashingOrder[]> => {
  const { data, error } = await supabase
    .from('washing_orders')
    .select(`
      *,
      sender_user:sender_user_id(id, first_name, last_name, email),
      washing_staff:washing_staff_id(id, first_name, last_name, email),
      washing_items:washing_order_items(
        *,
        canastilla:canastilla_id(id, codigo, size, color, status)
      )
    `)
    .in('status', ['ENVIADO', 'RECIBIDO', 'LAVADO_COMPLETADO', 'ENTREGADO'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Obtener una orden específica por ID
export const getWashingOrderById = async (orderId: string): Promise<WashingOrder | null> => {
  const { data, error } = await supabase
    .from('washing_orders')
    .select(`
      *,
      sender_user:sender_user_id(id, first_name, last_name, email),
      washing_staff:washing_staff_id(id, first_name, last_name, email),
      washing_items:washing_order_items(
        *,
        canastilla:canastilla_id(id, codigo, size, color, status)
      )
    `)
    .eq('id', orderId)
    .single()

  if (error) throw error
  return data
}

// Obtener historial de órdenes completadas/canceladas
export const getWashingHistory = async (userId: string, limit: number = 50): Promise<WashingOrder[]> => {
  const { data, error } = await supabase
    .from('washing_orders')
    .select(`
      *,
      sender_user:sender_user_id(id, first_name, last_name, email),
      washing_staff:washing_staff_id(id, first_name, last_name, email),
      washing_items:washing_order_items(
        *,
        canastilla:canastilla_id(id, codigo, size, color, status)
      )
    `)
    .or(`sender_user_id.eq.${userId},washing_staff_id.eq.${userId}`)
    .in('status', ['CONFIRMADO', 'CANCELADO'])
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

// ========== FUNCIONES DE CREACIÓN ==========

// Generar número de remisión
const generateRemisionNumber = async (tipo: 'ENTREGA' | 'DEVOLUCION'): Promise<string> => {
  const prefix = tipo === 'ENTREGA' ? 'RLE' : 'RLD'
  const column = tipo === 'ENTREGA' ? 'remision_entrega_number' : 'remision_devolucion_number'

  const { data } = await supabase
    .from('washing_orders')
    .select(column)
    .not(column, 'is', null)
    .order(column, { ascending: false })
    .limit(1)

  let nextNumber = 1
  if (data && data.length > 0) {
    const lastNumber = data[0][column]
    if (lastNumber) {
      const numPart = parseInt(lastNumber.substring(3), 10)
      nextNumber = numPart + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(6, '0')}`
}

// Crear nueva orden de lavado
export const createWashingOrder = async (
  senderUserId: string,
  washingStaffId: string,
  canastillaIds: string[],
  notes?: string
): Promise<WashingOrder> => {
  // Generar número de remisión de entrega
  const remisionNumber = await generateRemisionNumber('ENTREGA')

  // Crear la orden
  const { data: order, error: orderError } = await supabase
    .from('washing_orders')
    .insert({
      sender_user_id: senderUserId,
      washing_staff_id: washingStaffId,
      status: 'ENVIADO',
      notes,
      remision_entrega_number: remisionNumber,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (orderError) throw orderError

  // Crear los items
  const items = canastillaIds.map(canastillaId => ({
    washing_order_id: order.id,
    canastilla_id: canastillaId,
    item_status: 'PENDIENTE' as WashingItemStatus,
  }))

  const { error: itemsError } = await supabase
    .from('washing_order_items')
    .insert(items)

  if (itemsError) throw itemsError

  // Actualizar estado de canastillas a EN_LAVADO
  const { error: updateError } = await supabase
    .from('canastillas')
    .update({ status: 'EN_LAVADO' })
    .in('id', canastillaIds)

  if (updateError) throw updateError

  return order
}

// ========== FUNCIONES DE CAMBIO DE ESTADO ==========

// Recibir orden (personal de lavado confirma recepción)
export const receiveOrder = async (
  orderId: string,
  washingStaffId: string
): Promise<void> => {
  const { error } = await supabase
    .from('washing_orders')
    .update({
      status: 'RECIBIDO',
      washing_staff_id: washingStaffId,
      received_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'ENVIADO')

  if (error) throw error
}

// Marcar lavado como completado
export const markWashingCompleted = async (
  orderId: string,
  itemUpdates?: { itemId: string; status: WashingItemStatus; notes?: string }[]
): Promise<void> => {
  // Actualizar la orden
  const { error: orderError } = await supabase
    .from('washing_orders')
    .update({
      status: 'LAVADO_COMPLETADO',
      washed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'RECIBIDO')

  if (orderError) throw orderError

  // Actualizar items si se proporcionan
  if (itemUpdates && itemUpdates.length > 0) {
    for (const update of itemUpdates) {
      const { error } = await supabase
        .from('washing_order_items')
        .update({
          item_status: update.status,
          notes: update.notes,
        })
        .eq('id', update.itemId)

      if (error) throw error
    }
  } else {
    // Si no se proporcionan actualizaciones, marcar todos como LAVADA
    const { error } = await supabase
      .from('washing_order_items')
      .update({ item_status: 'LAVADA' })
      .eq('washing_order_id', orderId)

    if (error) throw error
  }
}

// Entregar canastillas lavadas
export const deliverOrder = async (orderId: string): Promise<string> => {
  // Generar número de remisión de devolución
  const remisionNumber = await generateRemisionNumber('DEVOLUCION')

  const { error } = await supabase
    .from('washing_orders')
    .update({
      status: 'ENTREGADO',
      remision_devolucion_number: remisionNumber,
      delivered_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'LAVADO_COMPLETADO')

  if (error) throw error

  return remisionNumber
}

// Confirmar recepción de canastillas lavadas (usuario final)
export const confirmReception = async (orderId: string): Promise<void> => {
  // Obtener los items de la orden
  const { data: order, error: fetchError } = await supabase
    .from('washing_orders')
    .select('washing_items:washing_order_items(canastilla_id)')
    .eq('id', orderId)
    .single()

  if (fetchError) throw fetchError

  const canastillaIds = order.washing_items?.map((item: any) => item.canastilla_id) || []

  // Actualizar la orden
  const { error: orderError } = await supabase
    .from('washing_orders')
    .update({
      status: 'CONFIRMADO',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'ENTREGADO')

  if (orderError) throw orderError

  // Actualizar estado de canastillas a DISPONIBLE
  if (canastillaIds.length > 0) {
    const { error: updateError } = await supabase
      .from('canastillas')
      .update({ status: 'DISPONIBLE' })
      .in('id', canastillaIds)

    if (updateError) throw updateError
  }
}

// Cancelar orden de lavado
export const cancelOrder = async (
  orderId: string,
  cancellationReason?: string
): Promise<void> => {
  // Obtener los items de la orden
  const { data: order, error: fetchError } = await supabase
    .from('washing_orders')
    .select('status, washing_items:washing_order_items(canastilla_id)')
    .eq('id', orderId)
    .single()

  if (fetchError) throw fetchError

  // Solo se puede cancelar si está en ENVIADO o RECIBIDO
  if (!['ENVIADO', 'RECIBIDO'].includes(order.status)) {
    throw new Error('Solo se pueden cancelar órdenes en estado ENVIADO o RECIBIDO')
  }

  const canastillaIds = order.washing_items?.map((item: any) => item.canastilla_id) || []

  // Actualizar la orden
  const { error: orderError } = await supabase
    .from('washing_orders')
    .update({
      status: 'CANCELADO',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cancellationReason,
    })
    .eq('id', orderId)

  if (orderError) throw orderError

  // Restaurar estado de canastillas a DISPONIBLE
  if (canastillaIds.length > 0) {
    const { error: updateError } = await supabase
      .from('canastillas')
      .update({ status: 'DISPONIBLE' })
      .in('id', canastillaIds)

    if (updateError) throw updateError
  }
}

// ========== FUNCIONES AUXILIARES ==========

// Obtener personal de lavado disponible
export const getWashingStaff = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, email')
    .eq('role', 'washing_staff')
    .eq('is_active', true)
    .order('first_name', { ascending: true })

  if (error) throw error
  return data || []
}

// Obtener canastillas disponibles para enviar a lavado (con paginación para manejar más de 1000)
export const getAvailableCanastillasForWashing = async (ownerId: string) => {
  const PAGE_SIZE = 1000
  let allCanastillas: any[] = []
  let hasMore = true
  let offset = 0

  while (hasMore) {
    const { data, error } = await supabase
      .from('canastillas')
      .select('*')
      .eq('current_owner_id', ownerId)
      .eq('status', 'DISPONIBLE')
      .order('codigo', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw error

    if (data && data.length > 0) {
      allCanastillas = [...allCanastillas, ...data]
      offset += PAGE_SIZE
      hasMore = data.length === PAGE_SIZE
    } else {
      hasMore = false
    }
  }

  return allCanastillas
}

// Calcular tiempos de una orden
export const calculateOrderTimes = (order: WashingOrder) => {
  const times: {
    waitingTime?: number
    washingTime?: number
    deliveryTime?: number
    totalTime?: number
  } = {}

  if (order.sent_at && order.received_at) {
    const sentDate = new Date(order.sent_at)
    const receivedDate = new Date(order.received_at)
    times.waitingTime = Math.round((receivedDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60)) // horas
  }

  if (order.received_at && order.washed_at) {
    const receivedDate = new Date(order.received_at)
    const washedDate = new Date(order.washed_at)
    times.washingTime = Math.round((washedDate.getTime() - receivedDate.getTime()) / (1000 * 60 * 60)) // horas
  }

  if (order.washed_at && order.delivered_at) {
    const washedDate = new Date(order.washed_at)
    const deliveredDate = new Date(order.delivered_at)
    times.deliveryTime = Math.round((deliveredDate.getTime() - washedDate.getTime()) / (1000 * 60 * 60)) // horas
  }

  if (order.sent_at && order.confirmed_at) {
    const sentDate = new Date(order.sent_at)
    const confirmedDate = new Date(order.confirmed_at)
    times.totalTime = Math.round((confirmedDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60)) // horas
  }

  return times
}

// Obtener estadísticas de lavado
export const getWashingStats = async (userId?: string) => {
  let query = supabase
    .from('washing_orders')
    .select('status', { count: 'exact' })

  if (userId) {
    query = query.or(`sender_user_id.eq.${userId},washing_staff_id.eq.${userId}`)
  }

  const { data, error } = await query

  if (error) throw error

  const stats = {
    total: data?.length || 0,
    enviado: 0,
    recibido: 0,
    lavadoCompletado: 0,
    entregado: 0,
    confirmado: 0,
    cancelado: 0,
  }

  data?.forEach((order: any) => {
    switch (order.status) {
      case 'ENVIADO': stats.enviado++; break
      case 'RECIBIDO': stats.recibido++; break
      case 'LAVADO_COMPLETADO': stats.lavadoCompletado++; break
      case 'ENTREGADO': stats.entregado++; break
      case 'CONFIRMADO': stats.confirmado++; break
      case 'CANCELADO': stats.cancelado++; break
    }
  })

  return stats
}
