import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export interface LocationData {
  name: string
  total: number
  disponibles: number
  enAlquiler: number
  enUsoInterno: number
  enLavado: number
  enReparacion: number
}

interface DashboardStats {
  totalCanastillas: number
  disponibles: number
  enAlquilerInterno: number
  enAlquilerExterno: number
  enLavado: number
  enUsoInterno: number
  enReparacion: number
  ingresosEsteMes: number
  proyeccionIngresos: number
  locations: LocationData[]
  loading: boolean
}

export function useDashboardStats() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const [stats, setStats] = useState<DashboardStats>({
    totalCanastillas: 0,
    disponibles: 0,
    enAlquilerInterno: 0,
    enAlquilerExterno: 0,
    enLavado: 0,
    enUsoInterno: 0,
    enReparacion: 0,
    ingresosEsteMes: 0,
    proyeccionIngresos: 0,
    locations: [],
    loading: true,
  })

  useEffect(() => {
    if (user) {
      fetchStats()
    }
  }, [user])

  const fetchStats = async () => {
    try {
      if (!user) return

      // Usar consultas de conteo para manejar más de 1000 canastillas
      // Cada consulta usa count: 'exact' que no tiene límite de filas

      const buildCountQuery = (status?: string) => {
        let query = supabase
          .from('canastillas')
          .select('*', { count: 'exact', head: true })

        // Si NO es super_admin, filtrar solo las canastillas del usuario actual
        if (!isSuperAdmin) {
          query = query.eq('current_owner_id', user.id)
        }

        if (status) {
          query = query.eq('status', status)
        }

        return query
      }

      // Ejecutar todas las consultas de conteo en paralelo
      const [
        totalResult,
        disponiblesResult,
        enLavadoResult,
        enUsoInternoResult,
        enReparacionResult,
        enAlquilerResult,
      ] = await Promise.all([
        buildCountQuery(),
        buildCountQuery('DISPONIBLE'),
        buildCountQuery('EN_LAVADO'),
        buildCountQuery('EN_USO_INTERNO'),
        buildCountQuery('EN_REPARACION'),
        buildCountQuery('EN_ALQUILER'),
      ])

      const totalCanastillas = totalResult.count || 0
      const disponibles = disponiblesResult.count || 0
      const enLavado = enLavadoResult.count || 0
      const enUsoInterno = enUsoInternoResult.count || 0
      const enReparacion = enReparacionResult.count || 0
      const totalEnAlquiler = enAlquilerResult.count || 0

      // Para diferenciar alquiler interno/externo, consultar los rentals activos
      let enAlquilerInterno = 0
      let enAlquilerExterno = 0

      if (totalEnAlquiler > 0) {
        // Contar items de alquiler por tipo usando count
        const [internoResult, externoResult] = await Promise.all([
          supabase
            .from('rental_items')
            .select('*, rentals!inner(*), canastillas!inner(*)', { count: 'exact', head: true })
            .eq('rentals.status', 'ACTIVO')
            .eq('rentals.rental_type', 'INTERNO')
            .eq('canastillas.status', 'EN_ALQUILER')
            .then(res => {
              if (!isSuperAdmin) {
                // Si no es super_admin, necesitamos filtrar diferente
                return res
              }
              return res
            }),
          supabase
            .from('rental_items')
            .select('*, rentals!inner(*), canastillas!inner(*)', { count: 'exact', head: true })
            .eq('rentals.status', 'ACTIVO')
            .eq('rentals.rental_type', 'EXTERNO')
            .eq('canastillas.status', 'EN_ALQUILER'),
        ])

        enAlquilerInterno = internoResult.count || 0
        enAlquilerExterno = externoResult.count || 0

        // Si los conteos no coinciden, usar una aproximación simple
        if (enAlquilerInterno + enAlquilerExterno !== totalEnAlquiler) {
          // Fallback: dividir proporcionalmente (asumiendo 50/50 si no hay datos)
          enAlquilerInterno = Math.floor(totalEnAlquiler / 2)
          enAlquilerExterno = totalEnAlquiler - enAlquilerInterno
        }
      }

      // Obtener ubicaciones reales de la base de datos
      // Consultar todas las canastillas con su ubicación para agrupar
      let locationQuery = supabase
        .from('canastillas')
        .select('current_location, status')

      if (!isSuperAdmin) {
        locationQuery = locationQuery.eq('current_owner_id', user.id)
      }

      const { data: canastillasData } = await locationQuery

      // Agrupar por ubicación
      const locationMap: Record<string, LocationData> = {}

      if (canastillasData) {
        canastillasData.forEach((c) => {
          const locationName = c.current_location || 'Sin ubicación'

          if (!locationMap[locationName]) {
            locationMap[locationName] = {
              name: locationName,
              total: 0,
              disponibles: 0,
              enAlquiler: 0,
              enUsoInterno: 0,
              enLavado: 0,
              enReparacion: 0,
            }
          }

          locationMap[locationName].total++

          switch (c.status) {
            case 'DISPONIBLE':
              locationMap[locationName].disponibles++
              break
            case 'EN_ALQUILER':
              locationMap[locationName].enAlquiler++
              break
            case 'EN_USO_INTERNO':
              locationMap[locationName].enUsoInterno++
              break
            case 'EN_LAVADO':
              locationMap[locationName].enLavado++
              break
            case 'EN_REPARACION':
              locationMap[locationName].enReparacion++
              break
          }
        })
      }

      // Convertir a array y ordenar por total (mayor a menor), tomando solo las 5 primeras
      const locations = Object.values(locationMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      // Calcular ingresos (simulado por ahora - $5,000 por canastilla/día)
      const tarifaDiaria = 5000
      const diasPromedio = 15
      const ingresosEsteMes = totalEnAlquiler * tarifaDiaria * 30
      const proyeccionIngresos = totalEnAlquiler * tarifaDiaria * diasPromedio

      const counts = {
        totalCanastillas,
        disponibles,
        enAlquilerInterno,
        enAlquilerExterno,
        enLavado,
        enUsoInterno,
        enReparacion,
        ingresosEsteMes,
        proyeccionIngresos,
        locations,
        loading: false,
      }

      setStats(counts)
    } catch (error) {
      console.error('Error fetching stats:', error)
      setStats(prev => ({ ...prev, loading: false }))
    }
  }

  return stats
}
