import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export interface UserLocation {
  id: string
  user_id: string
  latitude: number
  longitude: number
  accuracy: number | null
  speed: number | null
  heading: number | null
  updated_at: string
  user?: {
    id: string
    first_name: string
    last_name: string
    role: string
    department: string | null
    phone: string | null
  }
  canastillas_count?: number
}

// Hook para ENVIAR la ubicación del usuario actual
export function useGeolocationSender(enabled: boolean = true) {
  const { user } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null)

  // Monitorear el estado del permiso de geolocalización
  useEffect(() => {
    if (!navigator.permissions) return

    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      setPermissionState(status.state)
      status.onchange = () => {
        setPermissionState(status.state)
      }
    }).catch(() => {
      // Algunos navegadores no soportan permissions API
    })
  }, [])
  const watchIdRef = useRef<number | null>(null)

  const sendLocation = useCallback(async (position: GeolocationPosition) => {
    if (!user?.id) return

    try {
      setSending(true)
      const { error: upsertError } = await supabase
        .from('user_locations')
        .upsert({
          user_id: user.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (upsertError) {
        console.error('Error enviando ubicación:', upsertError)
        setError(upsertError.message)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSending(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!enabled || !user?.id || !navigator.geolocation) return

    // Enviar ubicación cada 15 segundos
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      (err) => setError(err.message),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [enabled, user?.id, sendLocation])

  return { sending, error, permissionState }
}

// Hook para VER las ubicaciones de todos los usuarios en tiempo real
export function useUserLocations() {
  const [locations, setLocations] = useState<UserLocation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_locations')
        .select(`
          *,
          user:users!user_locations_user_id_fkey (
            id, first_name, last_name, role, department, phone
          )
        `)
        .order('updated_at', { ascending: false })

      if (error) throw error

      // Contar canastillas por usuario
      const locationsWithCount = await Promise.all(
        (data || []).map(async (loc: Record<string, unknown>) => {
          const { count } = await supabase
            .from('canastillas')
            .select('*', { count: 'exact', head: true })
            .eq('current_owner_id', loc.user_id)

          return {
            ...loc,
            canastillas_count: count || 0,
          }
        })
      )

      setLocations(locationsWithCount)
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLocations()

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('user_locations_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_locations' },
        () => {
          fetchLocations()
        }
      )
      .subscribe()

    // Refrescar cada 30 segundos como fallback
    const interval = setInterval(fetchLocations, 30000)

    return () => {
      channel.unsubscribe()
      clearInterval(interval)
    }
  }, [fetchLocations])

  return { locations, loading, refetch: fetchLocations }
}
