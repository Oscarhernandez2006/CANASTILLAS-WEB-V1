/**
 * @module useTrazabilidad
 * @description Hook para la trazabilidad completa de canastillas.
 * Agrupa canastillas en lotes por fecha, tamaño, color y tipo de propiedad,
 * y permite consultar todos los movimientos (traspasos, alquileres, lavados, devoluciones)
 * de un lote seleccionado.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ============================================================
// TIPOS
// ============================================================

export interface LoteGroup {
  id: string
  size: string
  color: string
  shape: string | null
  tipo_propiedad: string
  totalCanastillas: number
  canastillaIds: string[]
  codigos: string[]
  createdAt: string
  statuses: Record<string, number>
}

export interface Movimiento {
  id: string
  tipo: 'CREACION' | 'TRASPASO' | 'ALQUILER' | 'LAVADO' | 'DEVOLUCION_TRASPASO' | 'DEVOLUCION_ALQUILER'
  fecha: string
  estado: string
  cantidad: number
  detalles: Record<string, unknown>
}

// ============================================================
// HELPER: consulta por lotes para evitar límites de .in()
// ============================================================

async function queryInBatches<T>(
  table: string,
  column: string,
  ids: string[],
  selectQuery: string,
  batchSize = 200
): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from(table)
      .select(selectQuery)
      .in(column, batch)
    if (error) throw error
    if (data) results.push(...(data as T[]))
  }
  return results
}

// ============================================================
// HOOK
// ============================================================

/**
 * Hook que gestiona la trazabilidad de canastillas agrupadas en lotes.
 * @returns Objeto con lotes, movimientos del lote seleccionado y funciones de control.
 * @returns {LoteGroup[]} lotes - Lotes agrupados de canastillas.
 * @returns {boolean} loading - Estado de carga de lotes.
 * @returns {LoteGroup | null} selectedLote - Lote seleccionado actualmente.
 * @returns {Movimiento[]} movimientos - Movimientos del lote seleccionado.
 * @returns {boolean} loadingMovimientos - Estado de carga de movimientos.
 * @returns {Function} fetchMovimientos - Carga los movimientos de un lote.
 * @returns {Function} refetch - Recarga la lista de lotes.
 */
export function useTrazabilidad() {
  const [lotes, setLotes] = useState<LoteGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLote, setSelectedLote] = useState<LoteGroup | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loadingMovimientos, setLoadingMovimientos] = useState(false)

  // ----------------------------------------------------------
  // 1. Cargar y agrupar canastillas en lotes
  // ----------------------------------------------------------
  const fetchLotes = useCallback(async () => {
    setLoading(true)
    try {
      let allCanastillas: Record<string, unknown>[] = []
      let page = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('canastillas')
          .select('id, codigo, size, color, shape, status, tipo_propiedad, created_at, current_location, current_area')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        allCanastillas = [...allCanastillas, ...data]
        if (data.length < pageSize) break
        page++
      }

      // Agrupar por fecha (minuto) + tamaño + color + tipo_propiedad
      const groups: Record<string, {
        id: string
        size: string
        color: string
        shape: string | null
        tipo_propiedad: string
        canastillaIds: string[]
        codigos: string[]
        createdAt: string
        statuses: Record<string, number>
      }> = {}

      for (const c of allCanastillas) {
        const ca = c as { id: string; codigo: string; size: string; color: string; shape: string | null; status: string; tipo_propiedad: string; created_at: string }
        const dateKey = ca.created_at.substring(0, 16)
        const key = `${dateKey}|${ca.size}|${ca.color}|${ca.tipo_propiedad}`

        if (!groups[key]) {
          groups[key] = {
            id: key,
            size: ca.size,
            color: ca.color,
            shape: ca.shape,
            tipo_propiedad: ca.tipo_propiedad,
            canastillaIds: [],
            codigos: [],
            createdAt: ca.created_at,
            statuses: {}
          }
        }

        groups[key].canastillaIds.push(ca.id)
        if (groups[key].codigos.length < 5) {
          groups[key].codigos.push(ca.codigo)
        }
        groups[key].statuses[ca.status] = (groups[key].statuses[ca.status] || 0) + 1
      }

      const lotesArray: LoteGroup[] = Object.values(groups)
        .map(g => ({ ...g, totalCanastillas: g.canastillaIds.length }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      setLotes(lotesArray)
    } catch (err) {
      console.error('Error fetching lotes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ----------------------------------------------------------
  // 2. Cargar movimientos de un lote seleccionado
  // ----------------------------------------------------------
  const fetchMovimientos = useCallback(async (lote: LoteGroup) => {
    setLoadingMovimientos(true)
    setSelectedLote(lote)

    try {
      const ids = lote.canastillaIds
      const result: Movimiento[] = []

      // ── CREACIÓN ──
      result.push({
        id: `creation-${lote.id}`,
        tipo: 'CREACION',
        fecha: lote.createdAt,
        estado: 'COMPLETADO',
        cantidad: lote.totalCanastillas,
        detalles: { size: lote.size, color: lote.color, tipo_propiedad: lote.tipo_propiedad }
      })

      // ── TRASPASOS ──
      try {
        const transferItems = await queryInBatches<{ transfer_id: string; canastilla_id: string }>(
          'transfer_items', 'canastilla_id', ids, 'transfer_id, canastilla_id'
        )

        if (transferItems.length > 0) {
          const transferIds = [...new Set(transferItems.map(ti => ti.transfer_id))]
          const { data: transfers } = await supabase
            .from('transfers')
            .select(`*, from_user:from_user_id(first_name, last_name), to_user:to_user_id(first_name, last_name)`)
            .in('id', transferIds)
            .order('requested_at', { ascending: true })

          if (transfers) {
            for (const t of transfers) {
              const itemCount = transferItems.filter(ti => ti.transfer_id === t.id).length
              result.push({
                id: `transfer-${t.id}`,
                tipo: 'TRASPASO',
                fecha: t.requested_at,
                estado: t.status,
                cantidad: itemCount,
                detalles: {
                  fromUser: t.from_user ? `${t.from_user.first_name} ${t.from_user.last_name}` : 'Desconocido',
                  toUser: t.to_user ? `${t.to_user.first_name} ${t.to_user.last_name}` : 'Desconocido',
                  isExternal: t.is_external_transfer,
                  externalRecipient: t.external_recipient_name,
                  externalEmpresa: t.external_recipient_empresa,
                  notes: t.notes,
                  remisionNumber: t.remision_number,
                  hasFirma: !!(t.firma_entrega_base64 || t.firma_recibe_base64)
                }
              })
            }
          }
        }
      } catch { /* tabla podría no existir */ }

      // ── ALQUILERES ──
      try {
        const rentalItems = await queryInBatches<{ rental_id: string; canastilla_id: string }>(
          'rental_items', 'canastilla_id', ids, 'rental_id, canastilla_id'
        )

        if (rentalItems.length > 0) {
          const rentalIds = [...new Set(rentalItems.map(ri => ri.rental_id))]
          const { data: rentals } = await supabase
            .from('rentals')
            .select(`*, sale_point:sale_points(name, code)`)
            .in('id', rentalIds)
            .order('start_date', { ascending: true })

          if (rentals) {
            for (const r of rentals) {
              const itemCount = rentalItems.filter(ri => ri.rental_id === r.id).length
              result.push({
                id: `rental-${r.id}`,
                tipo: 'ALQUILER',
                fecha: r.start_date,
                estado: r.status,
                cantidad: itemCount,
                detalles: {
                  salePoint: r.sale_point?.name || 'N/A',
                  salePointCode: r.sale_point?.code,
                  rentalType: r.rental_type,
                  dailyRate: r.daily_rate,
                  totalAmount: r.total_amount,
                  invoiceNumber: r.invoice_number,
                  remisionNumber: r.remision_number,
                  estimatedDays: r.estimated_days,
                  actualDays: r.actual_days
                }
              })
            }
          }
        }
      } catch { /* tabla podría no existir */ }

      // ── LAVADO ──
      try {
        const washingItems = await queryInBatches<{ washing_order_id: string; canastilla_id: string; item_status: string }>(
          'washing_order_items', 'canastilla_id', ids, 'washing_order_id, canastilla_id, item_status'
        )

        if (washingItems.length > 0) {
          const washingIds = [...new Set(washingItems.map(wi => wi.washing_order_id))]
          const { data: washings } = await supabase
            .from('washing_orders')
            .select(`*, sender_user:sender_user_id(first_name, last_name), washing_staff:washing_staff_id(first_name, last_name)`)
            .in('id', washingIds)
            .order('sent_at', { ascending: true })

          if (washings) {
            for (const w of washings) {
              const items = washingItems.filter(wi => wi.washing_order_id === w.id)
              result.push({
                id: `washing-${w.id}`,
                tipo: 'LAVADO',
                fecha: w.sent_at,
                estado: w.status,
                cantidad: items.length,
                detalles: {
                  senderUser: w.sender_user ? `${w.sender_user.first_name} ${w.sender_user.last_name}` : 'Desconocido',
                  washingStaff: w.washing_staff ? `${w.washing_staff.first_name} ${w.washing_staff.last_name}` : 'Sin asignar',
                  notes: w.notes,
                  remisionEntrega: w.remision_entrega_number,
                  remisionDevolucion: w.remision_devolucion_number,
                  washedCount: items.filter(i => i.item_status === 'LAVADA').length,
                  damagedCount: items.filter(i => i.item_status === 'DANADA').length
                }
              })
            }
          }
        }
      } catch { /* tabla podría no existir */ }

      // ── DEVOLUCIÓN TRASPASO ──
      try {
        const trItems = await queryInBatches<{ transfer_return_id: string; canastilla_id: string }>(
          'transfer_return_items', 'canastilla_id', ids, 'transfer_return_id, canastilla_id'
        )

        if (trItems.length > 0) {
          const returnIds = [...new Set(trItems.map(i => i.transfer_return_id))]
          const { data: returns } = await supabase
            .from('transfer_returns')
            .select(`*, processed_by_user:processed_by(first_name, last_name)`)
            .in('id', returnIds)
            .order('return_date', { ascending: true })

          if (returns) {
            for (const ret of returns) {
              const itemCount = trItems.filter(i => i.transfer_return_id === ret.id).length
              result.push({
                id: `transfer-return-${ret.id}`,
                tipo: 'DEVOLUCION_TRASPASO',
                fecha: ret.return_date,
                estado: 'COMPLETADO',
                cantidad: itemCount,
                detalles: {
                  processedBy: ret.processed_by_user ? `${ret.processed_by_user.first_name} ${ret.processed_by_user.last_name}` : 'Desconocido',
                  notes: ret.notes,
                  hasFirma: !!(ret.firma_entrega_base64 || ret.firma_recibe_base64)
                }
              })
            }
          }
        }
      } catch { /* tabla podría no existir */ }

      // ── DEVOLUCIÓN ALQUILER ──
      try {
        const rrItems = await queryInBatches<{ rental_return_id: string; canastilla_id: string }>(
          'rental_return_items', 'canastilla_id', ids, 'rental_return_id, canastilla_id'
        )

        if (rrItems.length > 0) {
          const returnIds = [...new Set(rrItems.map(i => i.rental_return_id))]
          const { data: returns } = await supabase
            .from('rental_returns')
            .select(`*, processed_by_user:processed_by(first_name, last_name)`)
            .in('id', returnIds)
            .order('return_date', { ascending: true })

          if (returns) {
            for (const ret of returns) {
              const itemCount = rrItems.filter(i => i.rental_return_id === ret.id).length
              result.push({
                id: `rental-return-${ret.id}`,
                tipo: 'DEVOLUCION_ALQUILER',
                fecha: ret.return_date,
                estado: 'COMPLETADO',
                cantidad: itemCount,
                detalles: {
                  processedBy: ret.processed_by_user ? `${ret.processed_by_user.first_name} ${ret.processed_by_user.last_name}` : 'Desconocido',
                  invoiceNumber: ret.invoice_number,
                  daysCharged: ret.days_charged,
                  amount: ret.amount,
                  notes: ret.notes
                }
              })
            }
          }
        }
      } catch { /* tabla podría no existir */ }

      // Ordenar cronológicamente
      result.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
      setMovimientos(result)
    } catch (err) {
      console.error('Error fetching movimientos:', err)
    } finally {
      setLoadingMovimientos(false)
    }
  }, [])

  useEffect(() => {
    fetchLotes()
  }, [fetchLotes])

  return {
    lotes,
    loading,
    selectedLote,
    movimientos,
    loadingMovimientos,
    fetchMovimientos,
    setSelectedLote,
    refreshLotes: fetchLotes
  }
}
