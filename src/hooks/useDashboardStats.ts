/**
 * @module useDashboardStats
 * @description Hook para obtener las estadísticas del dashboard principal.
 * Calcula totales de canastillas por estado, ingresos del mes, proyecciones
 * y distribución por ubicación. Filtra por usuario o muestra todo para super_admin.
 */
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
  enRetorno: number
}

interface DashboardStats {
  totalCanastillas: number
  disponibles: number
  enAlquilerInterno: number
  enAlquilerExterno: number
  enLavado: number
  enUsoInterno: number
  enReparacion: number
  enRetorno: number
  ingresosEsteMes: number
  proyeccionIngresos: number
  locations: LocationData[]
  loading: boolean
}

/**
 * Hook que consulta y calcula las estadísticas generales del dashboard.
 * @returns {DashboardStats} Objeto con totales de canastillas por estado, ingresos, proyecciones, ubicaciones y estado de carga.
 */
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
    enRetorno: 0,
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
      // Para "disponibles", SIEMPRE filtrar por current_owner_id del usuario (como en traspasos)
      const buildDisponiblesUserQuery = () => {
        return supabase
          .from('canastillas')
          .select('*', { count: 'exact', head: true })
          .eq('current_owner_id', user.id)
          .eq('status', 'DISPONIBLE')
      }

      const [
        totalResult,
        disponiblesResult,
        enLavadoResult,
        enUsoInternoResult,
        enReparacionResult,
        enAlquilerResult,
        enRetornoResult,
      ] = await Promise.all([
        buildCountQuery(),
        buildDisponiblesUserQuery(),
        buildCountQuery('EN_LAVADO'),
        buildCountQuery('EN_USO_INTERNO'),
        buildCountQuery('EN_REPARACION'),
        buildCountQuery('EN_ALQUILER'),
        buildCountQuery('EN_RETORNO'),
      ])

      const totalCanastillas = totalResult.count || 0
      const disponiblesTotal = disponiblesResult.count || 0
      const enLavado = enLavadoResult.count || 0
      const enUsoInterno = enUsoInternoResult.count || 0
      const enReparacion = enReparacionResult.count || 0
      const enRetorno = enRetornoResult.count || 0
      const totalEnAlquiler = enAlquilerResult.count || 0

      // Calcular canastillas retenidas en traspasos pendientes del usuario (igual que en traspasos)
      let canastillasRetenidasCount = 0

      {
        const { data: traspasosPendientes } = await supabase
          .from('transfers')
          .select('id')
          .eq('from_user_id', user.id)
          .eq('status', 'PENDIENTE')

        if (traspasosPendientes && traspasosPendientes.length > 0) {
          const transferIds = traspasosPendientes.map(t => t.id)
          const BATCH_SIZE = 500
          for (let i = 0; i < transferIds.length; i += BATCH_SIZE) {
            const batch = transferIds.slice(i, i + BATCH_SIZE)
            const { count } = await supabase
              .from('transfer_items')
              .select('*', { count: 'exact', head: true })
              .in('transfer_id', batch)
            canastillasRetenidasCount += count || 0
          }
        }
      }

      // Disponibles reales = DISPONIBLE - retenidas en traspasos pendientes
      const disponibles = Math.max(0, disponiblesTotal - canastillasRetenidasCount)

      // Para diferenciar alquiler interno/externo, consultar los rentals activos
      let enAlquilerInterno = 0
      let enAlquilerExterno = 0

      if (totalEnAlquiler > 0) {
        // Construir consultas base con filtro por owner si no es super_admin
        const buildRentalCountQuery = (rentalType: string) => {
          let query = supabase
            .from('rental_items')
            .select('*, rentals!inner(*), canastillas!inner(*)', { count: 'exact', head: true })
            .eq('rentals.status', 'ACTIVO')
            .eq('rentals.rental_type', rentalType)
            .eq('canastillas.status', 'EN_ALQUILER')

          if (!isSuperAdmin) {
            query = query.eq('canastillas.current_owner_id', user.id)
          }

          return query
        }

        const [internoResult, externoResult] = await Promise.all([
          buildRentalCountQuery('INTERNO'),
          buildRentalCountQuery('EXTERNO'),
        ])

        enAlquilerInterno = internoResult.count || 0
        enAlquilerExterno = externoResult.count || 0

        // Si los conteos no coinciden, usar proporción basada en datos reales
        if (enAlquilerInterno + enAlquilerExterno !== totalEnAlquiler) {
          const total = enAlquilerInterno + enAlquilerExterno
          if (total > 0) {
            // Escalar proporcionalmente al total real
            const ratio = totalEnAlquiler / total
            enAlquilerInterno = Math.round(enAlquilerInterno * ratio)
            enAlquilerExterno = totalEnAlquiler - enAlquilerInterno
          } else {
            enAlquilerInterno = Math.floor(totalEnAlquiler / 2)
            enAlquilerExterno = totalEnAlquiler - enAlquilerInterno
          }
        }
      }

      // Obtener ubicaciones reales de la base de datos
      // Consultar TODAS las canastillas con paginación (Supabase limita a 1000 por consulta)
      const PAGE_SIZE = 1000
      let allCanastillasData: { current_location: string | null; current_area: string | null; status: string; current_owner_id: string | null }[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        let locationQuery = supabase
          .from('canastillas')
          .select('current_location, current_area, status, current_owner_id')
          .not('status', 'in', '(DADA_DE_BAJA,EXTRAVIADA)')

        if (!isSuperAdmin) {
          locationQuery = locationQuery.eq('current_owner_id', user.id)
        }

        const { data: batch } = await locationQuery
          .range(offset, offset + PAGE_SIZE - 1)

        if (batch && batch.length > 0) {
          allCanastillasData = [...allCanastillasData, ...batch]
          offset += PAGE_SIZE
          hasMore = batch.length === PAGE_SIZE
        } else {
          hasMore = false
        }
      }

      // Agrupar por ubicación
      // Si no tiene current_location, intentar usar el nombre del propietario
      // Obtener mapa de usuarios para resolver nombres
      const ownerIds = [...new Set(allCanastillasData.filter(c => (!c.current_location || c.current_location.trim() === '') && c.current_owner_id).map(c => c.current_owner_id!))]
      const ownerMap: Record<string, string> = {}

      if (ownerIds.length > 0) {
        const BATCH_USERS = 500
        for (let i = 0; i < ownerIds.length; i += BATCH_USERS) {
          const batch = ownerIds.slice(i, i + BATCH_USERS)
          const { data: usersData } = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .in('id', batch)
          if (usersData) {
            for (const u of usersData) {
              ownerMap[u.id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Sin nombre'
            }
          }
        }
      }

      const locationMap: Record<string, LocationData> = {}

      // Cargar TODAS las ubicaciones registradas en canastilla_attributes para que aparezcan aunque tengan 0 canastillas
      const { data: allLocations } = await supabase
        .from('canastilla_attributes')
        .select('value')
        .eq('attribute_type', 'UBICACION')
        .eq('is_active', true)
        .order('value')

      if (allLocations) {
        for (const loc of allLocations) {
          if (loc.value && loc.value.trim() !== '') {
            locationMap[loc.value] = {
              name: loc.value,
              total: 0,
              disponibles: 0,
              enAlquiler: 0,
              enUsoInterno: 0,
              enLavado: 0,
              enReparacion: 0,
              enRetorno: 0,
            }
          }
        }
      }

      allCanastillasData.forEach((c) => {
        let locationName = c.current_location && c.current_location.trim() !== '' 
          ? c.current_location 
          : (c.current_owner_id && ownerMap[c.current_owner_id] 
              ? `👤 ${ownerMap[c.current_owner_id]}` 
              : 'Sin ubicación')

        if (!locationMap[locationName]) {
          locationMap[locationName] = {
            name: locationName,
            total: 0,
            disponibles: 0,
            enAlquiler: 0,
            enUsoInterno: 0,
            enLavado: 0,
            enReparacion: 0,
            enRetorno: 0,
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
          case 'EN_RETORNO':
            locationMap[locationName].enRetorno++
            break
        }
      })

      // Convertir a array y ordenar por total (mayor a menor)
      const locations = Object.values(locationMap)
        .sort((a, b) => b.total - a.total)

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
        enRetorno,
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
