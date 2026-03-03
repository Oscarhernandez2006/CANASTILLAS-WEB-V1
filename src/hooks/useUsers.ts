import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string | null
  role: string
  is_active: boolean
  department?: string | null
  area?: string | null
  created_at: string
  updated_at: string
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, is_active, department, area, created_at, updated_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching users:', error)
        throw error
      }

      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const refreshUsers = () => {
    fetchUsers()
  }

  return {
    users,
    loading,
    refreshUsers,
  }
}