import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { RentalSettings } from '@/types'

export function useRentalSettings() {
  const [settings, setSettings] = useState<RentalSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('rental_settings')
        .select('*')
        .limit(1)
        .maybeSingle() // Usar maybeSingle para no lanzar error si no hay datos

      if (error) {
        console.error('Error fetching rental settings:', error)
        // Si no hay configuración, usar valores por defecto temporales
        // El admin debe ejecutar el SQL para crear la configuración
        setSettings(null)
        return
      }

      if (!data) {
        console.warn('No rental settings found. Please run fix_rental_settings_complete.sql')
        setSettings(null)
        return
      }

      setSettings(data)
    } catch (error) {
      console.error('Error fetching rental settings:', error)
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }

  const updateDailyRate = async (newRate: number, userId: string) => {
    try {
      // Obtener el ID actual de settings
      const currentId = settings?.id
      if (!currentId) {
        return false
      }

      const { error } = await supabase
        .from('rental_settings')
        .update({
          daily_rate: newRate,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', currentId)

      if (error) throw error
      await fetchSettings()
      return true
    } catch (error) {
      console.error('Error updating daily rate:', error)
      return false
    }
  }

  const updateInternalRate = async (newRate: number, userId: string) => {
    try {
      const currentId = settings?.id
      if (!currentId) {
        return false
      }

      const { error } = await supabase
        .from('rental_settings')
        .update({
          internal_rate: newRate,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', currentId)

      if (error) throw error
      await fetchSettings()
      return true
    } catch (error) {
      console.error('Error updating internal rate:', error)
      return false
    }
  }

  const updateSettings = async (dailyRate: number, internalRate: number, userId: string) => {
    try {
      const currentId = settings?.id

      if (!currentId) {
        // Si no hay ID, crear nuevo registro
        const { error: insertError } = await supabase
          .from('rental_settings')
          .insert([{
            daily_rate: dailyRate,
            internal_rate: internalRate,
            currency: 'COP',
            updated_at: new Date().toISOString(),
            updated_by: userId
          }])

        if (insertError) throw insertError
        await fetchSettings()
        return { success: true }
      }

      // Si hay ID, actualizar
      const { error } = await supabase
        .from('rental_settings')
        .update({
          daily_rate: dailyRate,
          internal_rate: internalRate,
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('id', currentId)

      if (error) throw error
      await fetchSettings()
      return { success: true }
    } catch (error: any) {
      console.error('Error updating settings:', error)
      return { success: false, error: error.message }
    }
  }

  return {
    settings,
    loading,
    updateDailyRate,
    updateInternalRate,
    updateSettings,
    refreshSettings: fetchSettings
  }
}