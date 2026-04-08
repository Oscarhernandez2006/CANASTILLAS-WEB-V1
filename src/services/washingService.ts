/**
 * @module washingService
 * @description Servicio de gestión del ciclo completo de órdenes de lavado de canastillas.
 * 
 * Flujo del lavado:
 * 1. ENVIAR: Usuario crea orden → canastillas pasan a estado EN_LAVADO
 * 2. RECIBIR: Personal de lavado confirma recepción
 * 3. LAVAR: Personal marca lavado como completado
 * 4. ENTREGAR: Personal entrega canastillas lavadas
 * 5. CONFIRMAR: Remitente confirma recepción → canastillas vuelven a DISPONIBLE
 * 
 * Cada transición valida el estado actual para evitar race conditions.
 * Las tablas involucradas son: `washing_orders`, `washing_order_items`, `canastillas`.
 */

import { supabase } from '@/lib/supabase'
import type { WashingOrder, WashingOrderStatus, WashingItemStatus } from '@/types'

// ========== FUNCIONES DE CONSULTA ==========

/**
 * Obtiene todas las órdenes de lavado donde el usuario es remitente o personal de lavado.
 * @param userId - UUID del usuario
 * @returns Array de órdenes con items y datos de usuario relacionados
 */
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

/**
 * Obtiene las órdenes enviadas por un usuario específico (como remitente).
 * @param userId - UUID del usuario remitente
 * @returns Array de órdenes enviadas
 */
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

/**
 * Obtiene todas las órdenes activas para el personal de lavado.
 * Incluye órdenes en estados: ENVIADO, RECIBIDO, LAVADO_COMPLETADO, ENTREGADO.
 * @returns Array de órdenes activas
 */
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

/**
 * Obtiene una orden de lavado específica por su ID con todos los datos relacionados.
 * @param orderId - UUID de la orden
 * @returns La orden completa con items y usuarios, o null
 */
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

/**
 * Obtiene el historial de órdenes completadas o canceladas de un usuario.
 * @param userId - UUID del usuario
 * @param limit - Cantidad máxima de resultados (default: 50)
 * @returns Array de órdenes históricas
 */
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

/**
 * Genera un número de remisión secuencial para órdenes de lavado.
 * Formato: RLE000001 (entrega) o RLD000001 (devolución)
 * @param tipo - Tipo de remisión: 'ENTREGA' o 'DEVOLUCION'
 * @returns Número de remisión generado
 */
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

/**
 * Crea una nueva orden de lavado. Genera remisión automática y
 * cambia el estado de las canastillas seleccionadas a EN_LAVADO.
 * @param senderUserId - UUID del usuario que envía a lavar
 * @param washingStaffId - UUID del personal de lavado asignado
 * @param canastillaIds - Array de UUIDs de canastillas a lavar
 * @param notes - Notas opcionales para la orden
 * @returns La orden de lavado creada
 */
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

/**
 * Marca una orden como recibida por el personal de lavado.
 * Solo funciona si la orden está en estado ENVIADO.
 * @param orderId - UUID de la orden
 * @param washingStaffId - UUID del personal que recibe
 * @throws Error si la orden ya fue procesada por otro usuario
 */
export const receiveOrder = async (
  orderId: string,
  washingStaffId: string
): Promise<void> => {
  const { data, error } = await supabase
    .from('washing_orders')
    .update({
      status: 'RECIBIDO',
      washing_staff_id: washingStaffId,
      received_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'ENVIADO')
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se pudo recibir la orden porque su estado cambió. Posiblemente fue cancelada o ya recibida. Actualiza la página.')
  }
}

/**
 * Marca el lavado como completado. Permite actualizar el estado individual
 * de cada canastilla (LAVADA o DANADA).
 * Solo funciona si la orden está en estado RECIBIDO.
 * @param orderId - UUID de la orden
 * @param itemUpdates - Actualizaciones opcionales por item (estado y notas)
 * @throws Error si la orden ya fue procesada
 */
export const markWashingCompleted = async (
  orderId: string,
  itemUpdates?: { itemId: string; status: WashingItemStatus; notes?: string }[]
): Promise<void> => {
  // Actualizar la orden
  const { data: orderData, error: orderError } = await supabase
    .from('washing_orders')
    .update({
      status: 'LAVADO_COMPLETADO',
      washed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'RECIBIDO')
    .select('id')

  if (orderError) throw orderError
  if (!orderData || orderData.length === 0) {
    throw new Error('No se pudo marcar como completado porque el estado de la orden cambió. Posiblemente fue cancelada. Actualiza la página.')
  }

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

/**
 * Entrega las canastillas lavadas. Genera remisión de devolución.
 * Solo funciona si la orden está en estado LAVADO_COMPLETADO.
 * @param orderId - UUID de la orden
 * @returns Número de remisión de devolución generado
 * @throws Error si la orden ya fue procesada
 */
export const deliverOrder = async (orderId: string): Promise<string> => {
  // Generar número de remisión de devolución
  const remisionNumber = await generateRemisionNumber('DEVOLUCION')

  const { data: deliverData, error } = await supabase
    .from('washing_orders')
    .update({
      status: 'ENTREGADO',
      remision_devolucion_number: remisionNumber,
      delivered_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'LAVADO_COMPLETADO')
    .select('id')

  if (error) throw error
  if (!deliverData || deliverData.length === 0) {
    throw new Error('No se pudo entregar la orden porque su estado cambió. Posiblemente fue cancelada. Actualiza la página.')
  }

  return remisionNumber
}

/**
 * Confirma la recepción de canastillas lavadas por el usuario remitente.
 * Cambia las canastillas de vuelta a estado DISPONIBLE.
 * Solo funciona si la orden está en estado ENTREGADO.
 * @param orderId - UUID de la orden
 * @throws Error si la orden ya fue procesada
 */
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
  const { data: confirmData, error: orderError } = await supabase
    .from('washing_orders')
    .update({
      status: 'CONFIRMADO',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('status', 'ENTREGADO')
    .select('id')

  if (orderError) throw orderError
  if (!confirmData || confirmData.length === 0) {
    throw new Error('No se pudo confirmar la recepción porque el estado de la orden cambió. Actualiza la página.')
  }

  // Actualizar estado de canastillas a DISPONIBLE
  if (canastillaIds.length > 0) {
    const { error: updateError } = await supabase
      .from('canastillas')
      .update({ status: 'DISPONIBLE' })
      .in('id', canastillaIds)

    if (updateError) throw updateError
  }
}

/**
 * Cancela una orden de lavado y restaura las canastillas a DISPONIBLE.
 * Solo se puede cancelar si está en estado ENVIADO o RECIBIDO.
 * @param orderId - UUID de la orden
 * @param cancellationReason - Razón de la cancelación
 * @throws Error si la orden ya avanzó de estado
 */
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

  // Actualizar la orden - incluir validación de status en WHERE para evitar race condition
  const { data: updateResult, error: orderError } = await supabase
    .from('washing_orders')
    .update({
      status: 'CANCELADO',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cancellationReason,
    })
    .eq('id', orderId)
    .in('status', ['ENVIADO', 'RECIBIDO'])
    .select('id')

  if (orderError) throw orderError

  if (!updateResult || updateResult.length === 0) {
    throw new Error('No se pudo cancelar la orden porque su estado cambió. Otro usuario ya la procesó. Por favor actualiza la página.')
  }

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

/**
 * Obtiene la lista de personal de lavado activo.
 * @returns Array de usuarios con rol washing_staff
 */
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

/**
 * Obtiene las canastillas disponibles de un usuario para enviar a lavado.
 * Usa paginación para manejar más de 1000 canastillas (límite de Supabase).
 * @param ownerId - UUID del dueño de las canastillas
 * @returns Array de canastillas en estado DISPONIBLE
 */
export const getAvailableCanastillasForWashing = async (ownerId: string) => {
  const PAGE_SIZE = 1000
  let allCanastillas: any[] = []
  let hasMore = true
  let offset = 0

  while (hasMore) {
    const { data, error } = await supabase
      .from('canastillas')
      .select('id, codigo, size, color, shape, condition, tipo_propiedad, status')
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

/**
 * Calcula los tiempos de cada etapa de una orden de lavado (en horas).
 * - waitingTime: tiempo entre envío y recepción
 * - washingTime: tiempo entre recepción y lavado completado
 * - deliveryTime: tiempo entre lavado completado y entrega
 * - totalTime: tiempo total entre envío y confirmación
 * @param order - Orden de lavado con timestamps
 * @returns Objeto con los tiempos calculados en horas
 */
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

/**
 * Obtiene estadísticas de órdenes de lavado agrupadas por estado.
 * @param userId - UUID del usuario (opcional, si no se proporciona trae todas)
 * @returns Objeto con conteo por cada estado de lavado
 */
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
