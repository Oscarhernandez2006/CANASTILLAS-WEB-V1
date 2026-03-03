import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Rental } from '@/types'

export function useRentals() {
  const [activeRentals, setActiveRentals] = useState<Rental[]>([])
  const [completedRentals, setCompletedRentals] = useState<Rental[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    if (user) {
      fetchRentals()
    }
  }, [user])

  // Función auxiliar para obtener el conteo real de items de un alquiler
  const getItemsCount = async (rentalId: string): Promise<number> => {
    const { count, error } = await supabase
      .from('rental_items')
      .select('*', { count: 'exact', head: true })
      .eq('rental_id', rentalId)

    if (error) {
      console.error('Error counting rental items:', error)
      return 0
    }
    return count || 0
  }

  const fetchRentals = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Alquileres activos - SIN rental_items para evitar límite de 1000
      // Solo los creados por el usuario actual
      const { data: activeData, error: activeError } = await supabase
        .from('rentals')
        .select(`
          *,
          sale_point:sale_points(*),
          rental_returns(
            id,
            return_date,
            days_charged,
            amount,
            invoice_number,
            notes,
            created_at,
            rental_return_items(
              canastilla:canastillas(id, codigo, size, color)
            )
          )
        `)
        .eq('status', 'ACTIVO')
        .eq('created_by', user.id)
        .order('start_date', { ascending: false })

      if (activeError) throw activeError

      // Obtener conteo real de items para cada alquiler activo
      const activeWithCounts = await Promise.all(
        (activeData || []).map(async (rental) => ({
          ...rental,
          items_count: await getItemsCount(rental.id),
          rental_items: [] // placeholder vacío
        }))
      )

      // Alquileres completados - SIN rental_items para evitar límite de 1000
      // Solo los creados por el usuario actual
      const { data: completedData, error: completedError } = await supabase
        .from('rentals')
        .select(`
          *,
          sale_point:sale_points(*),
          rental_returns(
            id,
            return_date,
            days_charged,
            amount,
            invoice_number,
            notes,
            created_at,
            rental_return_items(
              canastilla:canastillas(id, codigo, size, color)
            )
          )
        `)
        .in('status', ['RETORNADO', 'VENCIDO', 'PERDIDO'])
        .eq('created_by', user.id)
        .order('actual_return_date', { ascending: false })
        .limit(50)

      if (completedError) throw completedError

      // Obtener conteo real de items para cada alquiler completado
      const completedWithCounts = await Promise.all(
        (completedData || []).map(async (rental) => ({
          ...rental,
          items_count: await getItemsCount(rental.id),
          rental_items: [] // placeholder vacío
        }))
      )

      setActiveRentals(activeWithCounts)
      setCompletedRentals(completedWithCounts)
    } catch (error) {
      console.error('Error fetching rentals:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshRentals = () => {
    fetchRentals()
  }

  return {
    activeRentals,
    completedRentals,
    loading,
    refreshRentals
  }
}