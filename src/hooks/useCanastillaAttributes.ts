/**
 * @module useCanastillaAttributes
 * @description Hook para gestionar atributos dinámicos de canastillas (colores, tamaños, formas, etc.).
 * Permite consultar los valores activos de un tipo de atributo y agregar nuevos valores.
 */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { AttributeType, CanastillaAttribute } from '@/types'

/**
 * Hook que obtiene y permite agregar atributos dinámicos de canastillas.
 * @param {AttributeType} attributeType - Tipo de atributo a consultar (ej: 'color', 'size', 'shape').
 * @returns Objeto con la lista de atributos, estado de carga, errores y funciones de gestión.
 * @returns {string[]} attributes - Valores activos del atributo.
 * @returns {boolean} loading - Indica si se están cargando los datos.
 * @returns {string | null} error - Mensaje de error, si existe.
 * @returns {Function} addAttribute - Agrega un nuevo valor de atributo.
 * @returns {Function} refresh - Recarga la lista de atributos.
 */
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
