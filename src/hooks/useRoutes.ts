/**
 * @module useRoutes
 * @description Hooks para la gestión de rutas de entrega.
 * Incluye `useRoutes` (admin/supervisor), `useDriverRoutes` (conductor),
 * `useRouteTracking` (tracking GPS en ruta) y `useRouteTrackingViewer` (visualización admin).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { logAuditEvent } from '@/services/auditService'
import {
  getRoutes,
  getMyRoutes,
  getRouteById,
  createRoute,
  updateRouteStatus,
  assignDriver,
  updateStopStatus,
  addTrackingPoint,
  getTrackingPoints,
  getAvailableDrivers,
} from '@/services/routeService'
import type { DeliveryRoute, DeliveryRouteStop, RouteTrackingPoint } from '@/types'

/**
 * Hook para gestión de rutas desde el panel de admin/supervisor.
 * Permite crear rutas, asignar conductores, actualizar estado y filtrar por estado/conductor.
 * @returns Objeto con rutas, conductores disponibles, filtros y funciones de gestión.
 */
export function useRoutes() {
  const [routes, setRoutes] = useState<DeliveryRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    try {
      const [data, driversData] = await Promise.all([
        getRoutes({
          status: statusFilter || undefined,
          driverId: driverFilter || undefined,
        }),
        getAvailableDrivers(),
      ])
      setRoutes(data)
      setDrivers(driversData)
    } catch (error) {
      console.error('Error fetching routes:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, driverFilter])

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  const handleCreateRoute = async (params: Parameters<typeof createRoute>[0]) => {
    const route = await createRoute(params)
    const currentUser = useAuthStore.getState().user
    if (currentUser) {
      await logAuditEvent({
        userId: currentUser.id,
        userName: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
        userRole: currentUser.role,
        action: 'CREATE',
        module: 'rutas',
        description: `Creación de ruta: ${params.name}`,
        details: { ruta_nombre: params.name, conductor: params.driverName, fecha: params.scheduledDate, paradas: params.stops.length },
      })
    }
    await fetchRoutes()
    return route
  }

  const handleAssignDriver = async (routeId: string, driverId: string, driverName: string) => {
    await assignDriver(routeId, driverId, driverName)
    const currentUser = useAuthStore.getState().user
    if (currentUser) {
      await logAuditEvent({
        userId: currentUser.id,
        userName: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
        userRole: currentUser.role,
        action: 'UPDATE',
        module: 'rutas',
        description: `Conductor asignado a ruta: ${driverName}`,
        details: { ruta_id: routeId, conductor_id: driverId, conductor_nombre: driverName },
      })
    }
    await fetchRoutes()
  }

  const handleUpdateStatus = async (routeId: string, status: string) => {
    await updateRouteStatus(routeId, status)
    const currentUser = useAuthStore.getState().user
    if (currentUser) {
      await logAuditEvent({
        userId: currentUser.id,
        userName: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
        userRole: currentUser.role,
        action: 'UPDATE',
        module: 'rutas',
        description: `Cambio de estado de ruta a: ${status}`,
        details: { ruta_id: routeId, nuevo_estado: status },
      })
    }
    await fetchRoutes()
  }

  return {
    routes,
    loading,
    drivers,
    statusFilter,
    driverFilter,
    setStatusFilter,
    setDriverFilter,
    createRoute: handleCreateRoute,
    assignDriver: handleAssignDriver,
    updateStatus: handleUpdateStatus,
    refetch: fetchRoutes,
  }
}

/**
 * Hook para conductores — consulta sus rutas asignadas y gestiona la ruta activa.
 * @returns Objeto con rutas del conductor, ruta activa y funciones de control.
 * @returns {DeliveryRoute[]} routes - Rutas asignadas al conductor.
 * @returns {DeliveryRoute | null} activeRoute - Ruta actualmente en curso.
 * @returns {Function} startRoute - Inicia una ruta.
 * @returns {Function} completeRoute - Completa una ruta.
 * @returns {Function} markStopStatus - Actualiza el estado de una parada.
 */
export function useDriverRoutes() {
  const { user } = useAuthStore()
  const [routes, setRoutes] = useState<DeliveryRoute[]>([])
  const [activeRoute, setActiveRoute] = useState<DeliveryRoute | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchRoutes = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await getMyRoutes(user.id)
      setRoutes(data)
      const enCurso = data.find(r => r.status === 'EN_CURSO')
      if (enCurso) setActiveRoute(enCurso)
    } catch (error) {
      console.error('Error fetching driver routes:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  const startRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'EN_CURSO')
    await fetchRoutes()
    const route = await getRouteById(routeId)
    if (route) setActiveRoute(route)
  }

  const completeRoute = async (routeId: string) => {
    await updateRouteStatus(routeId, 'COMPLETADA')
    setActiveRoute(null)
    await fetchRoutes()
  }

  const markStopStatus = async (
    stopId: string,
    status: string,
    extras?: { driver_notes?: string; driver_latitude?: number; driver_longitude?: number },
  ) => {
    await updateStopStatus(stopId, status, extras)
    const currentUser = useAuthStore.getState().user
    if (currentUser && (status === 'COMPLETADA' || status === 'OMITIDA')) {
      await logAuditEvent({
        userId: currentUser.id,
        userName: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
        userRole: currentUser.role,
        action: 'UPDATE',
        module: 'rutas',
        description: `Parada ${status === 'COMPLETADA' ? 'completada' : 'omitida'} en ruta`,
        details: { parada_id: stopId, estado: status },
      })
    }
    if (activeRoute) {
      const updated = await getRouteById(activeRoute.id)
      if (updated) setActiveRoute(updated)
    }
  }

  return {
    routes,
    activeRoute,
    loading,
    startRoute,
    completeRoute,
    markStopStatus,
    refetch: fetchRoutes,
  }
}

/**
 * Hook para tracking GPS en tiempo real del conductor durante una ruta.
 * Utiliza `navigator.geolocation.watchPosition` y envía puntos al servidor.
 * @param {string | null} routeId - ID de la ruta a rastrear, o `null` para desactivar.
 * @returns {{ tracking: boolean, currentPosition: { lat: number, lng: number } | null, startTracking: Function, stopTracking: Function }}
 */
export function useRouteTracking(routeId: string | null) {
  const { user } = useAuthStore()
  const watchIdRef = useRef<number | null>(null)
  const [tracking, setTracking] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null)

  const startTracking = useCallback(() => {
    if (!routeId || !user?.id || !navigator.geolocation) return

    setTracking(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, speed, heading } = position.coords
        setCurrentPosition({ lat: latitude, lng: longitude })

        try {
          await addTrackingPoint({
            routeId,
            driverId: user.id,
            latitude,
            longitude,
            speed: speed ?? undefined,
            heading: heading ?? undefined,
          })
        } catch (err) {
          console.error('Error saving tracking point:', err)
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    )
  }, [routeId, user?.id])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTracking(false)
  }, [])

  useEffect(() => {
    return () => stopTracking()
  }, [stopTracking])

  return { tracking, currentPosition, startTracking, stopTracking }
}

/**
 * Hook para visualizar el tracking de una ruta desde el panel de administración.
 * Realiza polling cada 10 segundos para obtener los puntos de rastreo.
 * @param {string | null} routeId - ID de la ruta a visualizar, o `null` para desactivar.
 * @returns {{ points: RouteTrackingPoint[], loading: boolean, refetch: Function }}
 */
export function useRouteTrackingViewer(routeId: string | null) {
  const [points, setPoints] = useState<RouteTrackingPoint[]>([])
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPoints = useCallback(async () => {
    if (!routeId) return
    setLoading(true)
    try {
      const data = await getTrackingPoints(routeId)
      setPoints(data)
    } catch (error) {
      console.error('Error fetching tracking points:', error)
    } finally {
      setLoading(false)
    }
  }, [routeId])

  // Polling cada 10 segundos
  useEffect(() => {
    if (!routeId) return
    fetchPoints()
    intervalRef.current = setInterval(fetchPoints, 10000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [routeId, fetchPoints])

  return { points, loading, refetch: fetchPoints }
}
