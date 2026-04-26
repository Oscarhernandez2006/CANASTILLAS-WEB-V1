/**
 * @module useHistorialTraspasos
 * @description Hook para consultar el historial completo de traspasos (admin).
 * Soporta filtros por estado, usuario, ubicación y número de remisión.
 * Suscripción en tiempo real a cambios en la tabla transfers.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface TransferUser {
  first_name: string
  last_name: string
  email: string
}

interface SalePoint {
  id: string
  name: string
  city: string
  address: string
}

export interface HistorialTransfer {
  id: string
  from_user_id: string
  to_user_id: string
  status: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'CANCELADO' | 'EXPIRADA' | 'ACEPTADO_AUTO'
  requested_at: string
  responded_at?: string
  remision_number?: string
  is_washing_transfer?: boolean
  is_external_transfer?: boolean
  external_recipient_name?: string
  external_recipient_empresa?: string
  sale_point_id?: string
  returned_items_count?: number
  pending_items_count?: number
  items_count?: number
  rejection_reason?: string
  from_user?: TransferUser
  to_user?: TransferUser
  sale_point?: SalePoint
}

export interface HistorialFilters {
  status: string
  search: string
  fromDate: string
  toDate: string
}

export interface StatusCounts {
  PENDIENTE: number
  ACEPTADO: number
  RECHAZADO: number
  CANCELADO: number
  EXPIRADA: number
  ACEPTADO_AUTO: number
  total: number
}

export function useHistorialTraspasos() {
  const [transfers, setTransfers] = useState<HistorialTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<HistorialFilters>({
    status: '',
    search: '',
    fromDate: '',
    toDate: '',
  })
  const [page, setPage] = useState(1)
  const pageSize = 30
  const [totalCount, setTotalCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    PENDIENTE: 0, ACEPTADO: 0, RECHAZADO: 0, CANCELADO: 0, total: 0,
  })

  // Fetch real counts per status from DB
  const fetchStatusCounts = useCallback(async () => {
    const statuses = ['PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'CANCELADO', 'EXPIRADA', 'ACEPTADO_AUTO'] as const
    const counts: StatusCounts = { PENDIENTE: 0, ACEPTADO: 0, RECHAZADO: 0, CANCELADO: 0, EXPIRADA: 0, ACEPTADO_AUTO: 0, total: 0 }

    await Promise.all(
      statuses.map(async (s) => {
        const { count } = await supabase
          .from('transfers')
          .select('*', { count: 'exact', head: true })
          .eq('status', s)
        counts[s] = count || 0
      })
    )
    counts.total = counts.PENDIENTE + counts.ACEPTADO + counts.RECHAZADO + counts.CANCELADO + counts.EXPIRADA + counts.ACEPTADO_AUTO
    setStatusCounts(counts)
  }, [])

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch global status counts (independent of filters)
      fetchStatusCounts()

      // Build query
      let query = supabase
        .from('transfers')
        .select(`
          *,
          from_user:from_user_id(first_name, last_name, email),
          to_user:to_user_id(first_name, last_name, email),
          sale_point:sale_points(id, name, city, address)
        `, { count: 'exact' })

      // Filter by status
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      // Filter by date range
      if (filters.fromDate) {
        query = query.gte('requested_at', filters.fromDate + 'T00:00:00')
      }
      if (filters.toDate) {
        query = query.lte('requested_at', filters.toDate + 'T23:59:59')
      }

      // Search by remision_number (applied at query level)
      if (filters.search && /^[0-9-]+$/.test(filters.search.trim())) {
        query = query.ilike('remision_number', `%${filters.search.trim()}%`)
      }

      // Order and paginate
      query = query
        .order('requested_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)

      const { data, error, count } = await query

      if (error) throw error

      let results = data || []

      // Client-side search for user name/email (can't do OR across relations in PostgREST)
      if (filters.search && !/^[0-9-]+$/.test(filters.search.trim())) {
        const searchLower = filters.search.trim().toLowerCase()
        results = results.filter((t: HistorialTransfer) => {
          const fromName = `${t.from_user?.first_name || ''} ${t.from_user?.last_name || ''}`.toLowerCase()
          const toName = `${t.to_user?.first_name || ''} ${t.to_user?.last_name || ''}`.toLowerCase()
          const fromEmail = (t.from_user?.email || '').toLowerCase()
          const toEmail = (t.to_user?.email || '').toLowerCase()
          const remision = (t.remision_number || '').toLowerCase()
          const extName = (t.external_recipient_name || '').toLowerCase()
          const extEmpresa = (t.external_recipient_empresa || '').toLowerCase()
          const salePointName = (t.sale_point?.name || '').toLowerCase()
          const salePointCity = (t.sale_point?.city || '').toLowerCase()

          return (
            fromName.includes(searchLower) ||
            toName.includes(searchLower) ||
            fromEmail.includes(searchLower) ||
            toEmail.includes(searchLower) ||
            remision.includes(searchLower) ||
            extName.includes(searchLower) ||
            extEmpresa.includes(searchLower) ||
            salePointName.includes(searchLower) ||
            salePointCity.includes(searchLower)
          )
        })
      }

      // Get item counts for each transfer
      const withCounts = await Promise.all(
        results.map(async (t: HistorialTransfer) => {
          const { count: itemCount } = await supabase
            .from('transfer_items')
            .select('*', { count: 'exact', head: true })
            .eq('transfer_id', t.id)
          return { ...t, items_count: itemCount || 0 }
        })
      )

      setTransfers(withCounts)
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Error fetching historial traspasos:', err)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  // Fetch on mount and when filters/page change
  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('historial-traspasos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transfers' },
        () => {
          fetchTransfers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTransfers])

  const updateFilter = useCallback((key: keyof HistorialFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({ status: '', search: '', fromDate: '', toDate: '' })
    setPage(1)
  }, [])

  const totalPages = Math.ceil(totalCount / pageSize)

  return {
    transfers,
    loading,
    filters,
    updateFilter,
    clearFilters,
    page,
    setPage,
    totalPages,
    totalCount,
    statusCounts,
    refetch: fetchTransfers,
  }
}
