/**
 * @module useSalePoints
 * @description Hook para obtener y gestionar los puntos de venta (clientes).
 * Consulta la tabla `sale_points` de Supabase y proporciona la lista
 * ordenada por fecha de creación.
 */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { SalePoint } from '@/types'

/**
 * Hook que obtiene todos los puntos de venta registrados.
 * @returns {{ salePoints: SalePoint[], loading: boolean, refreshSalePoints: Function }} Lista de puntos de venta, estado de carga y función de refresco.
 */
export function useSalePoints() {
  const [salePoints, setSalePoints] = useState<SalePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSalePoints()
  }, [])

  const fetchSalePoints = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('sale_points')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSalePoints(data || [])
    } catch (error) {
      console.error('Error fetching sale points:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshSalePoints = () => {
    fetchSalePoints()
  }

  return {
    salePoints,
    loading,
    refreshSalePoints,
  }
}