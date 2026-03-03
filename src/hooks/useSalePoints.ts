import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { SalePoint } from '@/types'

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