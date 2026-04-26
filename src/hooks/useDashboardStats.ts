/**
 * @module useDashboardStats
 * @description Hook para obtener las estadísticas del dashboard principal.
 * Calcula totales de canastillas por estado, ingresos del mes, proyecciones
 * y distribución por ubicación. Filtra por usuario o muestra todo para super_admin.
 */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export type DashboardFilter = 'todos' | 'procesos' | 'clientes_externos' | 'puntos_venta' | 'conductores'

export interface LocationData {
  userId: string
  name: string
  ubicacion: string
  area: string
  role: string
  filterCategory: DashboardFilter
  total: number
  disponibles: number
  enAlquiler: number
  enUsoInterno: number
  enLavado: number
  enReparacion: number
  enRetorno: number
  entradasHoy: number
  salidasHoy: number
  entradasPromedio: number
  salidasPromedio: number
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
  const isConsultorProceso = user?.role === 'consultor_proceso'
  const canSeeAllCanastillas = isSuperAdmin || isConsultorProceso

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
          .not('status', 'in', '(DADA_DE_BAJA,EXTRAVIADA,ARCHIVADA)')

        // Si NO es super_admin ni consultor_proceso, filtrar solo las canastillas del usuario actual
        if (!canSeeAllCanastillas) {
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

      // Calcular canastillas retenidas en traspasos pendientes del usuario (solo DISPONIBLE)
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
            // Solo contar items cuya canastilla sea DISPONIBLE (no EN_ALQUILER u otros)
            const { count } = await supabase
              .from('transfer_items')
              .select('*, canastillas!inner(*)', { count: 'exact', head: true })
              .in('transfer_id', batch)
              .eq('canastillas.status', 'DISPONIBLE')
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

          if (!canSeeAllCanastillas) {
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

      // Obtener TODAS las canastillas con paginación + owner info
      const PAGE_SIZE = 1000
      let allCanastillasData: { current_location: string | null; current_area: string | null; status: string; current_owner_id: string | null }[] = []
      let hasMore = true
      let offset = 0

      while (hasMore) {
        let locationQuery = supabase
          .from('canastillas')
          .select('current_location, current_area, status, current_owner_id')
          .not('status', 'in', '(DADA_DE_BAJA,EXTRAVIADA,ARCHIVADA)')

        if (!canSeeAllCanastillas) {
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

      // Obtener TODOS los usuarios para agrupar (incluir conductores para filtro)
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, first_name, last_name, role, department')

      const userMap: Record<string, { name: string; role: string; department: string }> = {}
      if (allUsers) {
        for (const u of allUsers) {
          userMap[u.id] = {
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.id,
            role: u.role || 'Sin rol',
            department: (u as any).department || '',
          }
        }
      }

      // Función para determinar la categoría de filtro
      const getFilterCategory = (role: string, isClient?: boolean): DashboardFilter => {
        if (isClient) return 'clientes_externos'
        if (role === 'conductor') return 'conductores'
        if (role === 'supervisor') return 'procesos'
        if (role === 'pdv') return 'puntos_venta'
        if (role === 'client') return 'clientes_externos'
        return 'procesos' // operator, washing_staff, logistics, admin, super_admin
      }

      // Obtener entradas y salidas de hoy y últimos 7 días para promedios
      const today = new Date()
      // Usar fecha LOCAL (no UTC) para comparar "hoy"
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString()

      // Traspasos aceptados de los últimos 7 días (para entradas y salidas)
      const { data: recentTransfers } = await supabase
        .from('transfers')
        .select('id, from_user_id, to_user_id, responded_at, status')
        .in('status', ['ACEPTADO', 'ACEPTADO_AUTO'])
        .gte('responded_at', sevenDaysAgoStr)

      // Contar items por transfer
      const transferIds = recentTransfers?.map(t => t.id) || []
      const transferItemCounts: Record<string, number> = {}

      if (transferIds.length > 0) {
        const BATCH_TI = 500
        for (let i = 0; i < transferIds.length; i += BATCH_TI) {
          const batch = transferIds.slice(i, i + BATCH_TI)
          const { data: items } = await supabase
            .from('transfer_items')
            .select('transfer_id')
            .in('transfer_id', batch)
            .limit(10000)
          if (items) {
            items.forEach(item => {
              transferItemCounts[item.transfer_id] = (transferItemCounts[item.transfer_id] || 0) + 1
            })
          }
        }
      }

      // Calcular entradas/salidas por usuario (hoy y últimos 7 días)
      const userEntradas: Record<string, { hoy: number; semana: number }> = {}
      const userSalidas: Record<string, { hoy: number; semana: number }> = {}

      recentTransfers?.forEach(t => {
        const count = transferItemCounts[t.id] || 0
        // Convertir responded_at a fecha LOCAL para comparar con "hoy"
        const localRespondedDate = t.responded_at ? new Date(t.responded_at) : null
        const respondedDay = localRespondedDate ? `${localRespondedDate.getFullYear()}-${String(localRespondedDate.getMonth() + 1).padStart(2, '0')}-${String(localRespondedDate.getDate()).padStart(2, '0')}` : ''
        const isToday = respondedDay === todayStr

        // Salidas del remitente
        if (!userSalidas[t.from_user_id]) userSalidas[t.from_user_id] = { hoy: 0, semana: 0 }
        userSalidas[t.from_user_id].semana += count
        if (isToday) userSalidas[t.from_user_id].hoy += count

        // Entradas del destinatario
        if (!userEntradas[t.to_user_id]) userEntradas[t.to_user_id] = { hoy: 0, semana: 0 }
        userEntradas[t.to_user_id].semana += count
        if (isToday) userEntradas[t.to_user_id].hoy += count
      })

      // Agrupar canastillas por usuario
      // Las canastillas EN_ALQUILER se agrupan aparte por cliente (current_location)
      const userStatsMap: Record<string, LocationData> = {}

      allCanastillasData.forEach((c) => {
        const ownerId = c.current_owner_id
        if (!ownerId) return

        // Verificar que el usuario existe
        if (!userMap[ownerId]) return

        const userName = userMap[ownerId].name
        const userRole = userMap[ownerId].role
        const ubicacion = c.current_location && c.current_location.trim() !== '' ? c.current_location : 'Sin ubicación'
        const area = c.current_area && c.current_area.trim() !== '' ? c.current_area : 'Sin área'

        // Si la canastilla está EN_ALQUILER, agrupar por cliente (current_location)
        if (c.status === 'EN_ALQUILER' && ubicacion !== 'Sin ubicación') {
          const clientKey = `client_${ubicacion}`
          if (!userStatsMap[clientKey]) {
            userStatsMap[clientKey] = {
              userId: clientKey,
              name: `🏢 ${ubicacion}`,
              ubicacion: ubicacion,
              area: 'Cliente externo',
              role: 'client',
              filterCategory: 'clientes_externos',
              total: 0,
              disponibles: 0,
              enAlquiler: 0,
              enUsoInterno: 0,
              enLavado: 0,
              enReparacion: 0,
              enRetorno: 0,
              entradasHoy: 0,
              salidasHoy: 0,
              entradasPromedio: 0,
              salidasPromedio: 0,
            }
          }
          userStatsMap[clientKey].total++
          userStatsMap[clientKey].enAlquiler++
          return
        }

        if (!userStatsMap[ownerId]) {
          const entradas = userEntradas[ownerId] || { hoy: 0, semana: 0 }
          const salidas = userSalidas[ownerId] || { hoy: 0, semana: 0 }
          const userDept = userMap[ownerId].department || ''

          userStatsMap[ownerId] = {
            userId: ownerId,
            name: userName,
            ubicacion: userDept || ubicacion,
            area: userDept || area,
            role: userRole,
            filterCategory: getFilterCategory(userRole),
            total: 0,
            disponibles: 0,
            enAlquiler: 0,
            enUsoInterno: 0,
            enLavado: 0,
            enReparacion: 0,
            enRetorno: 0,
            entradasHoy: entradas.hoy,
            salidasHoy: salidas.hoy,
            entradasPromedio: Math.round(entradas.semana / 7),
            salidasPromedio: Math.round(salidas.semana / 7),
          }
        }

        // Solo actualizar ubicación si el usuario no tiene department asignado
        const userDeptCheck = userMap[ownerId].department
        if (!userDeptCheck) {
          if (ubicacion !== 'Sin ubicación') {
            userStatsMap[ownerId].ubicacion = ubicacion
          }
          if (area !== 'Sin área') {
            userStatsMap[ownerId].area = area
          }
        }

        userStatsMap[ownerId].total++

        switch (c.status) {
          case 'DISPONIBLE':
            userStatsMap[ownerId].disponibles++
            break
          case 'EN_ALQUILER':
            userStatsMap[ownerId].enAlquiler++
            break
          case 'EN_USO_INTERNO':
            userStatsMap[ownerId].enUsoInterno++
            break
          case 'EN_LAVADO':
            userStatsMap[ownerId].enLavado++
            break
          case 'EN_REPARACION':
            userStatsMap[ownerId].enReparacion++
            break
          case 'EN_RETORNO':
            userStatsMap[ownerId].enRetorno++
            break
        }
      })

      // Convertir a array y ordenar por total (mayor a menor)
      let locations = Object.values(userStatsMap)
        .sort((a, b) => b.total - a.total)

      // Filtrar ubicaciones para consultor_proceso: mostrar todo excepto puntos de venta y otras ubicaciones excluidas
      const EXCLUIR_EXACTOS = ['CANASTILLERO', 'EN TRANSITO', 'INVERSIONES SERRANO', 'LA PARISIENNE', 'OFICINA DE SISTEMAS']
      if (isConsultorProceso) {
        locations = locations.filter(l => {
          const dept = (userMap[l.userId]?.department || '').toUpperCase()
          const ubic = l.ubicacion.toUpperCase()
          // Excluir puntos de venta (PDV), clientes externos y ubicaciones específicas
          const isPDV = ubic.startsWith('PDV') || dept.startsWith('PDV')
          const isClienteExterno = l.filterCategory === 'clientes_externos'
          const isExcluido = EXCLUIR_EXACTOS.includes(dept) || EXCLUIR_EXACTOS.includes(ubic)
          return !isPDV && !isClienteExterno && !isExcluido
        })
      }

      // Calcular ingresos (simulado por ahora - $5,000 por canastilla/día)
      const tarifaDiaria = 5000
      const diasPromedio = 15
      const ingresosEsteMes = totalEnAlquiler * tarifaDiaria * 30
      const proyeccionIngresos = totalEnAlquiler * tarifaDiaria * diasPromedio

      // Recalcular totales para consultor_proceso basándose en ubicaciones filtradas
      if (isConsultorProceso) {
        const totals = locations.reduce((acc, l) => ({
          total: acc.total + l.total,
          disponibles: acc.disponibles + l.disponibles,
          enAlquiler: acc.enAlquiler + l.enAlquiler,
          enUsoInterno: acc.enUsoInterno + l.enUsoInterno,
          enLavado: acc.enLavado + l.enLavado,
          enReparacion: acc.enReparacion + l.enReparacion,
          enRetorno: acc.enRetorno + l.enRetorno,
        }), { total: 0, disponibles: 0, enAlquiler: 0, enUsoInterno: 0, enLavado: 0, enReparacion: 0, enRetorno: 0 })

        setStats({
          totalCanastillas: totals.total,
          disponibles: totals.disponibles,
          enAlquilerInterno: totals.enAlquiler,
          enAlquilerExterno: 0,
          enLavado: totals.enLavado,
          enUsoInterno: totals.enUsoInterno,
          enReparacion: totals.enReparacion,
          enRetorno: totals.enRetorno,
          ingresosEsteMes: 0,
          proyeccionIngresos: 0,
          locations,
          loading: false,
        })
        return
      }

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
