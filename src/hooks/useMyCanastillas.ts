import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Canastilla } from '@/types'

export function useMyCanastillas() {
  const [canastillas, setCanastillas] = useState<Canastilla[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    if (user) {
      fetchMyCanastillas()
    }
  }, [user])

  const fetchMyCanastillas = async () => {
    if (!user) return

    try {
      setLoading(true)
      console.log('Fetching canastillas for user:', user.id)

      // Cargar TODAS las canastillas usando paginación interna
      // Supabase limita a 1000 filas por consulta
      const PAGE_SIZE = 1000
      let allCanastillas: Canastilla[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        const { data, error } = await supabase
          .from('canastillas')
          .select('*')
          .eq('current_owner_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)

        if (error) {
          console.error('Error fetching canastillas:', error)
          throw error
        }

        if (data && data.length > 0) {
          allCanastillas = [...allCanastillas, ...data]
          offset += PAGE_SIZE
          hasMore = data.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      console.log('Canastillas fetched:', allCanastillas.length)
      setCanastillas(allCanastillas)
    } catch (error) {
      console.error('Error fetching my canastillas:', error)
      setCanastillas([])
    } finally {
      setLoading(false)
    }
  }

  const refreshCanastillas = () => {
    fetchMyCanastillas()
  }

  return { canastillas, loading, refreshCanastillas }
}