import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { AttributeType, CanastillaAttribute } from '@/types'

export function useCanastillaAttributes(attributeType: AttributeType) {
  const [attributes, setAttributes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAttributes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('canastilla_attributes')
        .select('value')
        .eq('attribute_type', attributeType)
        .eq('is_active', true)
        .order('value')

      if (error) throw error

      const values = data?.map((attr) => attr.value) || []
      setAttributes(values)
      setError(null)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching attributes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAttributes()
  }, [attributeType])

  const addAttribute = async (value: string): Promise<void> => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id

      const { error } = await supabase.rpc('add_canastilla_attribute', {
        p_attribute_type: attributeType,
        p_value: value,
        p_user_id: userId,
      })

      if (error) throw error

      // Refrescar la lista
      await fetchAttributes()
    } catch (err: any) {
      console.error('Error adding attribute:', err)
      throw err
    }
  }

  return {
    attributes,
    loading,
    error,
    addAttribute,
    refresh: fetchAttributes,
  }
}
